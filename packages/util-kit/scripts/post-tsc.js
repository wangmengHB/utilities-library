const { existsSync, readFileSync, writeFileSync } = require('fs');
const { sync } = require('globby');
const { dirname, relative, resolve, join } = require('path');

/*
"baseUrl": ".",
"outDir": "lib",
"paths": {
  "src/*": ["src/*"]
},
*/

const configFile = resolve(__dirname, '../tsconfig.json');
const srcRoot = resolve(__dirname, '../src');
const outRoot = resolve(__dirname, '../lib');



const loadConfig = (tsconfig) => {
  const {
    extends: ext,
    compilerOptions: { baseUrl, outDir, paths } = {
      baseUrl: undefined,
      outDir: undefined,
      paths: undefined,
    },
  } = require(tsconfig);

  const config = {};
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }
  if (outDir) {
    config.outDir = outDir;
  }
  if (paths) {
    config.paths = paths;
  }

  if (ext) {
    const parentConfig = loadConfig(resolve(dirname(tsconfig), ext));
    return {
      ...parentConfig,
      ...config,
    };
  }

  return config;
};




console.log(
  `tscpaths --project ${configFile} --src ${srcRoot} --out ${outRoot}`
);

const { baseUrl, outDir, paths } = loadConfig(configFile);

if (!baseUrl) {
  throw new Error('compilerOptions.baseUrl is not set');
}
if (!paths) {
  throw new Error('compilerOptions.paths is not set');
}
if (!outDir) {
  throw new Error('compilerOptions.outDir is not set');
}


const configDir = dirname(configFile);
const basePath = resolve(configDir, baseUrl);
const outPath = outRoot || resolve(basePath, outDir);


const outFileToSrcFile = (x) =>
  resolve(srcRoot, relative(outPath, x));

const aliases = Object.keys(paths)
  .map((alias) => ({
    prefix: alias.replace(/\*$/, ''),
    aliasPaths: paths[alias].map((p) =>
      resolve(basePath, p.replace(/\*$/, ''))
    ),
  }))
  .filter(({ prefix }) => prefix);


const toRelative = (from, x) => {
  const rel = relative(from, x);
  return (rel.startsWith('.') ? rel : `./${rel}`).replace(/\\/g, '/');
};

const exts = ['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.json'];

let replaceCount = 0;

const absToRel = (modulePath, outFile) => {
  const alen = aliases.length;
  for (let j = 0; j < alen; j += 1) {
    const { prefix, aliasPaths } = aliases[j];

    if (modulePath.startsWith(prefix)) {
      const modulePathRel = modulePath.substring(prefix.length);
      const srcFile = outFileToSrcFile(outFile);
      const outRel = relative(basePath, outFile);
      const len = aliasPaths.length;
      for (let i = 0; i < len; i += 1) {
        const apath = aliasPaths[i];
        const moduleSrc = resolve(apath, modulePathRel);
        if (
          existsSync(moduleSrc) ||
          exts.some((ext) => existsSync(moduleSrc + ext))
        ) {
          const rel = toRelative(dirname(srcFile), moduleSrc);
          replaceCount += 1;
          
          return rel;
        }
      }
      console.log(`could not replace ${modulePath}`);
    }
  }
  return modulePath;
};

const requireRegex = /(?:import|require)\(['"]([^'"]*)['"]\)/g;
const importRegex = /(?:import|from) ['"]([^'"]*)['"]/g;

const replaceImportStatement = (
  orig,
  matched,
  outFile
) => {
  const index = orig.indexOf(matched);
  return (
    orig.substring(0, index) +
    absToRel(matched, outFile) +
    orig.substring(index + matched.length)
  );
};

const replaceAlias = (text, outFile) =>
  text
    .replace(requireRegex, (orig, matched) =>
      replaceImportStatement(orig, matched, outFile)
    )
    .replace(importRegex, (orig, matched) =>
      replaceImportStatement(orig, matched, outFile)
    );

// import relative to absolute path
const files = sync(`${outPath}/**/*.{js,jsx,ts,tsx}`, {
  dot: true,
  noDir: true,
}).map((x) => resolve(x));

let changedFileCount = 0;

const flen = files.length;
for (let i = 0; i < flen; i += 1) {
  const file = files[i];
  const text = readFileSync(file, 'utf8');
  const prevReplaceCount = replaceCount;
  const newText = replaceAlias(text, file);
  if (text !== newText) {
    changedFileCount += 1;
    console.log(`${file}: replaced ${replaceCount - prevReplaceCount} paths`);
    writeFileSync(file, newText, 'utf8');
  }
}

console.log(`Replaced ${replaceCount} paths in ${changedFileCount} files`);


// TODO remove tests in the the lib path.

console.log('remove the "tests" folders in the lib folder later.')

