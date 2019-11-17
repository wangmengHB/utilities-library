
export interface IFilter {
	// Returns null if word doesn't match.
	(word: string, wordToMatchAgainst: string): IMatch[] | null;
}

export interface IMatch {
	start: number;
	end: number;
}

/**
 * A tuple of three values.
 * 0. the score
 * 1. the matches encoded as bitmask (2^53)
 * 2. the offset at which matching started
 */
export type FuzzyScore = [number, number, number];

export interface FuzzyScorer {
	(pattern: string, lowPattern: string, patternPos: number, word: string, lowWord: string, wordPos: number, firstMatchCanBeWeak: boolean): FuzzyScore | undefined;
}


export interface IDisposable {
	dispose(): void;
}

export interface IReference<T> extends IDisposable {
	readonly object: T;
}



