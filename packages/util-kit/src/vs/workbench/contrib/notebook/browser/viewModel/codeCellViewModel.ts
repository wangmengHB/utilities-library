/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import * as UUID from 'vs/base/common/uuid';
import * as editorCommon from 'vs/editor/common/editorCommon';
import * as model from 'vs/editor/common/model';
import { PrefixSumComputer } from 'vs/editor/common/viewModel/prefixSumComputer';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BOTTOM_CELL_TOOLBAR_GAP, BOTTOM_CELL_TOOLBAR_HEIGHT, CELL_BOTTOM_MARGIN, CELL_MARGIN, CELL_RUN_GUTTER, CELL_TOP_MARGIN, CODE_CELL_LEFT_MARGIN, COLLAPSED_INDICATOR_HEIGHT, EDITOR_BOTTOM_PADDING, EDITOR_TOOLBAR_HEIGHT } from 'vs/workbench/contrib/notebook/browser/constants';
import { CellEditState, CellFindMatch, CodeCellLayoutChangeEvent, CodeCellLayoutInfo, CodeCellLayoutState, getEditorTopPadding, ICellViewModel, NotebookLayoutInfo } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { NotebookEventDispatcher } from 'vs/workbench/contrib/notebook/browser/viewModel/eventDispatcher';
import { NotebookCellTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookCellTextModel';
import { CellKind, INotebookSearchOptions, NotebookCellOutputsSplice } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { BaseCellViewModel } from './baseCellViewModel';

export class CodeCellViewModel extends BaseCellViewModel implements ICellViewModel {
	readonly cellKind = CellKind.Code;
	protected readonly _onDidChangeOutputs = new Emitter<NotebookCellOutputsSplice[]>();
	readonly onDidChangeOutputs = this._onDidChangeOutputs.event;
	private _outputCollection: number[] = [];
	private _selfSizeMonitoring: boolean = false;
	set selfSizeMonitoring(newVal: boolean) {
		this._selfSizeMonitoring = newVal;
	}

	get selfSizeMonitoring() {
		return this._selfSizeMonitoring;
	}

	private _outputsTop: PrefixSumComputer | null = null;
	get outputs() {
		return this.model.outputs;
	}

	protected readonly _onDidChangeLayout = new Emitter<CodeCellLayoutChangeEvent>();
	readonly onDidChangeLayout = this._onDidChangeLayout.event;

	private _editorHeight = 0;
	set editorHeight(height: number) {
		this._editorHeight = height;

		this.layoutChange({ editorHeight: true });
	}

	get editorHeight() {
		throw new Error('editorHeight is write-only');
	}

	private _hoveringOutput: boolean = false;
	public get outputIsHovered(): boolean {
		return this._hoveringOutput;
	}

	public set outputIsHovered(v: boolean) {
		this._hoveringOutput = v;
		this._onDidChangeState.fire({ outputIsHoveredChanged: true });
	}

	private _layoutInfo: CodeCellLayoutInfo;

	get layoutInfo() {
		return this._layoutInfo;
	}

	constructor(
		readonly viewType: string,
		readonly model: NotebookCellTextModel,
		initialNotebookLayoutInfo: NotebookLayoutInfo | null,
		readonly eventDispatcher: NotebookEventDispatcher,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(viewType, model, UUID.generateUuid(), configurationService);
		this._register(this.model.onDidChangeOutputs((splices) => {
			splices.reverse().forEach(splice => {
				this._outputCollection.splice(splice[0], splice[1], ...splice[2].map(() => 0));
			});
			this._outputsTop = null;
			this._onDidChangeOutputs.fire(splices);
		}));

		this._outputCollection = new Array(this.model.outputs.length);

		this._layoutInfo = {
			fontInfo: initialNotebookLayoutInfo?.fontInfo || null,
			editorHeight: 0,
			editorWidth: initialNotebookLayoutInfo ? this.computeEditorWidth(initialNotebookLayoutInfo.width) : 0,
			outputContainerOffset: 0,
			outputTotalHeight: 0,
			outputShowMoreContainerHeight: 0,
			outputShowMoreContainerOffset: 0,
			totalHeight: 0,
			indicatorHeight: 0,
			bottomToolbarOffset: 0,
			layoutState: CodeCellLayoutState.Uninitialized
		};
	}

	private computeEditorWidth(outerWidth: number): number {
		return outerWidth - (CODE_CELL_LEFT_MARGIN + (CELL_MARGIN * 2) + CELL_RUN_GUTTER);
	}

	layoutChange(state: CodeCellLayoutChangeEvent) {
		// recompute
		this._ensureOutputsTop();
		const outputShowMoreContainerHeight = state.outputShowMoreContainerHeight ? state.outputShowMoreContainerHeight : this._layoutInfo.outputShowMoreContainerHeight;
		let outputTotalHeight = this.metadata?.outputCollapsed ? COLLAPSED_INDICATOR_HEIGHT : this._outputsTop!.getTotalValue();

		if (!this.metadata?.inputCollapsed) {
			let newState: CodeCellLayoutState;
			let editorHeight: number;
			let totalHeight: number;
			if (!state.editorHeight && this._layoutInfo.layoutState === CodeCellLayoutState.FromCache) {
				// No new editorHeight info - keep cached totalHeight and estimate editorHeight
				editorHeight = this.estimateEditorHeight(state.font?.lineHeight);
				totalHeight = this._layoutInfo.totalHeight;
				newState = CodeCellLayoutState.FromCache;
			} else if (state.editorHeight || this._layoutInfo.layoutState === CodeCellLayoutState.Measured) {
				// Editor has been measured
				editorHeight = this._editorHeight;
				totalHeight = this.computeTotalHeight(this._editorHeight, outputTotalHeight, outputShowMoreContainerHeight);
				newState = CodeCellLayoutState.Measured;
			} else {
				editorHeight = this.estimateEditorHeight(state.font?.lineHeight);
				totalHeight = this.computeTotalHeight(editorHeight, outputTotalHeight, outputShowMoreContainerHeight);
				newState = CodeCellLayoutState.Estimated;
			}

			const statusbarHeight = this.getEditorStatusbarHeight();
			const indicatorHeight = editorHeight + statusbarHeight + outputTotalHeight + outputShowMoreContainerHeight;
			const outputContainerOffset = EDITOR_TOOLBAR_HEIGHT + CELL_TOP_MARGIN + editorHeight + statusbarHeight;
			const outputShowMoreContainerOffset = totalHeight - BOTTOM_CELL_TOOLBAR_GAP - BOTTOM_CELL_TOOLBAR_HEIGHT / 2 - outputShowMoreContainerHeight;
			const bottomToolbarOffset = totalHeight - BOTTOM_CELL_TOOLBAR_GAP - BOTTOM_CELL_TOOLBAR_HEIGHT / 2;
			const editorWidth = state.outerWidth !== undefined ? this.computeEditorWidth(state.outerWidth) : this._layoutInfo?.editorWidth;

			this._layoutInfo = {
				fontInfo: state.font || null,
				editorHeight,
				editorWidth,
				outputContainerOffset,
				outputTotalHeight,
				outputShowMoreContainerHeight,
				outputShowMoreContainerOffset,
				totalHeight,
				indicatorHeight,
				bottomToolbarOffset,
				layoutState: newState
			};
		} else {
			outputTotalHeight = this.metadata?.inputCollapsed && this.metadata.outputCollapsed ? 0 : outputTotalHeight;
			const indicatorHeight = COLLAPSED_INDICATOR_HEIGHT + outputTotalHeight + outputShowMoreContainerHeight;
			const outputContainerOffset = CELL_TOP_MARGIN + COLLAPSED_INDICATOR_HEIGHT;
			const totalHeight = CELL_TOP_MARGIN + COLLAPSED_INDICATOR_HEIGHT + CELL_BOTTOM_MARGIN + BOTTOM_CELL_TOOLBAR_GAP + outputTotalHeight + outputShowMoreContainerHeight;
			const outputShowMoreContainerOffset = totalHeight - BOTTOM_CELL_TOOLBAR_GAP - BOTTOM_CELL_TOOLBAR_HEIGHT / 2 - outputShowMoreContainerHeight;
			const bottomToolbarOffset = totalHeight - BOTTOM_CELL_TOOLBAR_GAP - BOTTOM_CELL_TOOLBAR_HEIGHT / 2;
			const editorWidth = state.outerWidth !== undefined ? this.computeEditorWidth(state.outerWidth) : this._layoutInfo?.editorWidth;

			this._layoutInfo = {
				fontInfo: state.font || null,
				editorHeight: this._layoutInfo.editorHeight,
				editorWidth,
				outputContainerOffset,
				outputTotalHeight,
				outputShowMoreContainerHeight,
				outputShowMoreContainerOffset,
				totalHeight,
				indicatorHeight,
				bottomToolbarOffset,
				layoutState: this._layoutInfo.layoutState
			};
		}

		if (state.editorHeight || state.outputHeight) {
			state.totalHeight = true;
		}

		this._fireOnDidChangeLayout(state);
	}

	private _fireOnDidChangeLayout(state: CodeCellLayoutChangeEvent) {
		this._onDidChangeLayout.fire(state);
	}

	restoreEditorViewState(editorViewStates: editorCommon.ICodeEditorViewState | null, totalHeight?: number) {
		super.restoreEditorViewState(editorViewStates);
		if (totalHeight !== undefined && this._layoutInfo.layoutState !== CodeCellLayoutState.Measured) {
			this._layoutInfo = {
				fontInfo: this._layoutInfo.fontInfo,
				editorHeight: this._layoutInfo.editorHeight,
				editorWidth: this._layoutInfo.editorWidth,
				outputContainerOffset: this._layoutInfo.outputContainerOffset,
				outputTotalHeight: this._layoutInfo.outputTotalHeight,
				outputShowMoreContainerHeight: this._layoutInfo.outputShowMoreContainerHeight,
				outputShowMoreContainerOffset: this._layoutInfo.outputShowMoreContainerOffset,
				totalHeight: totalHeight,
				indicatorHeight: this._layoutInfo.indicatorHeight,
				bottomToolbarOffset: this._layoutInfo.bottomToolbarOffset,
				layoutState: CodeCellLayoutState.FromCache
			};
		}
	}

	hasDynamicHeight() {
		// CodeCellVM always measures itself and controls its cell's height
		return false;
	}

	firstLine(): string {
		return this.getText().split('\n')[0];
	}

	getHeight(lineHeight: number) {
		if (this._layoutInfo.layoutState === CodeCellLayoutState.Uninitialized) {
			const editorHeight = this.estimateEditorHeight(lineHeight);
			return this.computeTotalHeight(editorHeight, 0, 0);
		} else {
			return this._layoutInfo.totalHeight;
		}
	}

	private estimateEditorHeight(lineHeight: number | undefined = 20): number {
		return this.lineCount * lineHeight + getEditorTopPadding() + EDITOR_BOTTOM_PADDING;
	}

	private computeTotalHeight(editorHeight: number, outputsTotalHeight: number, outputShowMoreContainerHeight: number): number {
		return EDITOR_TOOLBAR_HEIGHT + CELL_TOP_MARGIN + editorHeight + this.getEditorStatusbarHeight() + outputsTotalHeight + outputShowMoreContainerHeight + BOTTOM_CELL_TOOLBAR_GAP + CELL_BOTTOM_MARGIN;
	}

	/**
	 * Text model is used for editing.
	 */
	async resolveTextModel(): Promise<model.ITextModel> {
		if (!this.textModel) {
			const ref = await this.model.resolveTextModelRef();
			this.textModel = ref.object.textEditorModel;
			this._register(ref);
			this._register(this.textModel.onDidChangeContent(() => {
				if (this.editState !== CellEditState.Editing) {
					this.editState = CellEditState.Editing;
					this._onDidChangeState.fire({ contentChanged: true });
				}
			}));
		}

		return this.textModel;
	}

	onDeselect() {
		this.editState = CellEditState.Preview;
	}

	updateOutputShowMoreContainerHeight(height: number) {
		this.layoutChange({ outputShowMoreContainerHeight: height });
	}

	updateOutputHeight(index: number, height: number) {
		if (index >= this._outputCollection.length) {
			throw new Error('Output index out of range!');
		}

		this._outputCollection[index] = height;
		this._ensureOutputsTop();
		if (this._outputsTop!.changeValue(index, height)) {
			this.layoutChange({ outputHeight: true });
		}
	}

	getOutputOffsetInContainer(index: number) {
		this._ensureOutputsTop();

		if (index >= this._outputCollection.length) {
			throw new Error('Output index out of range!');
		}

		return this._outputsTop!.getAccumulatedValue(index - 1);
	}

	getOutputOffset(index: number): number {
		return this.layoutInfo.outputContainerOffset + this.getOutputOffsetInContainer(index);
	}

	spliceOutputHeights(start: number, deleteCnt: number, heights: number[]) {
		this._ensureOutputsTop();

		this._outputsTop!.removeValues(start, deleteCnt);
		if (heights.length) {
			const values = new Uint32Array(heights.length);
			for (let i = 0; i < heights.length; i++) {
				values[i] = heights[i];
			}

			this._outputsTop!.insertValues(start, values);
		}

		this.layoutChange({ outputHeight: true });
	}

	private _ensureOutputsTop(): void {
		if (!this._outputsTop) {
			const values = new Uint32Array(this._outputCollection.length);
			for (let i = 0; i < this._outputCollection.length; i++) {
				values[i] = this._outputCollection[i];
			}

			this._outputsTop = new PrefixSumComputer(values);
		}
	}

	private readonly _hasFindResult = this._register(new Emitter<boolean>());
	public readonly hasFindResult: Event<boolean> = this._hasFindResult.event;

	startFind(value: string, options: INotebookSearchOptions): CellFindMatch | null {
		const matches = super.cellStartFind(value, options);

		if (matches === null) {
			return null;
		}

		return {
			cell: this,
			matches
		};
	}

	dispose() {
		super.dispose();
	}
}
