const path = require('path');
const shell = require('shelljs');


const VS_CODE_GIT = `https://github.com/microsoft/vscode.git`;
const VS_CODE_FOLDER = path.join(__dirname, '../vscode');
const VS_BASE_COMMON_PATH = path.join(__dirname, '../vscode/src/vs/base/common');
const VS_BASE_COMMON_TEST_PATH = path.join(__dirname, '../vscode/src/vs/base/test/common');

const TARGET_COMMON_PATH = path.join(__dirname, '../src/vs/base/');
const TARGET_TEST_COMMON_PATH = path.join(__dirname, '../test/');

if (!shell.which('git')) {
    shell.echo('Sorry, this script requires git');
    shell.exit(1);
}

// check if vscode folder exist, if exist, git pull; if not, git clone.
if (!shell.test('-d', VS_CODE_FOLDER)) {
    if (shell.exec(`git clone ${VS_CODE_GIT}`).code !== 0) {
        shell.echo('Error: Failed to clone vscode!');
        shell.exit(1);
    }
} else {
    shell.cd('vscode');
    if (shell.exec(`git pull origin master`).code !== 0) {
        shell.echo('Error: git pull origin master from vscode!');
        shell.exit(1);
    }
    shell.cd('..')
}

if (!shell.test('-d', VS_BASE_COMMON_PATH)) {
    shell.echo('Error: vscode base common snippet does not exist!');
    shell.exit(1);
}

if (!shell.test('-d', VS_BASE_COMMON_TEST_PATH)) {
    shell.echo('Error: unit test for vscode base common snippet does not exist!');
    shell.exit(1);
}

shell.cp('-Rf', VS_BASE_COMMON_PATH, TARGET_COMMON_PATH);
shell.cp('-Rf', VS_BASE_COMMON_TEST_PATH, TARGET_TEST_COMMON_PATH);

// TODO: check the difference manually.
shell.echo('You should manually check the difference before commit.');




