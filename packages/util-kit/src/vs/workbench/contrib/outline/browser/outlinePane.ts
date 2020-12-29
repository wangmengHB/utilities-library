/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./outlinePane';
import * as dom from 'vs/base/browser/dom';
import { ProgressBar } from 'vs/base/browser/ui/progressbar/progressbar';
import { createCancelablePromise, TimeoutTimer } from 'vs/base/common/async';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { IDisposable, toDisposable, DisposableStore, MutableDisposable } from 'vs/base/common/lifecycle';
import { LRUCache } from 'vs/base/common/map';
import { ICodeEditor, isCodeEditor, isDiffEditor } from 'vs/editor/browser/editorBrowser';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { ITextModel } from 'vs/editor/common/model';
import { IModelContentChangedEvent } from 'vs/editor/common/model/textModelEvents';
import { DocumentSymbolProviderRegistry } from 'vs/editor/common/modes';
import { LanguageFeatureRegistry } from 'vs/editor/common/modes/languageFeatureRegistry';
import { OutlineElement, OutlineModel, TreeElement, IOutlineMarker } from 'vs/editor/contrib/documentSymbols/outlineModel';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ContextKeyEqualsExpr, IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TextEditorSelectionRevealType } from 'vs/platform/editor/common/editor';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { attachProgressBarStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ViewAction, ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { OutlineConfigKeys, OutlineViewFocused, OutlineViewFiltered, OutlineViewId } from 'vs/editor/contrib/documentSymbols/outline';
import { FuzzyScore } from 'vs/base/common/filters';
import { OutlineDataSource, OutlineItemComparator, OutlineSortOrder, OutlineVirtualDelegate, OutlineGroupRenderer, OutlineElementRenderer, OutlineItem, OutlineIdentityProvider, OutlineNavigationLabelProvider, OutlineFilter, OutlineAccessibilityProvider } from 'vs/editor/contrib/documentSymbols/outlineTree';
import { IDataTreeViewState } from 'vs/base/browser/ui/tree/dataTree';
import { basename } from 'vs/base/common/resources';
import { IDataSource } from 'vs/base/browser/ui/tree/tree';
import { IMarkerDecorationsService } from 'vs/editor/common/services/markersDecorationService';
import { MarkerSeverity } from 'vs/platform/markers/common/markers';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Codicon } from 'vs/base/common/codicons';
import { MenuId, registerAction2 } from 'vs/platform/actions/common/actions';

class RequestState {

	constructor(
		private _editorId: string,
		private _modelId: string,
		private _modelVersion: number,
		private _providerCount: number
	) {
		//
	}

	equals(other: RequestState): boolean {
		return other
			&& this._editorId === other._editorId
			&& this._modelId === other._modelId
			&& this._modelVersion === other._modelVersion
			&& this._providerCount === other._providerCount;
	}
}

class RequestOracle {

	private readonly _disposables = new DisposableStore();
	private _sessionDisposable = new MutableDisposable();
	private _lastState?: RequestState;

	constructor(
		private readonly _callback: (editor: ICodeEditor | undefined, change: IModelContentChangedEvent | undefined) => any,
		private readonly _featureRegistry: LanguageFeatureRegistry<any>,
		@IEditorService private readonly _editorService: IEditorService,
	) {
		_editorService.onDidActiveEditorChange(this._update, this, this._disposables);
		_featureRegistry.onDidChange(this._update, this, this._disposables);
		this._update();
	}

	dispose(): void {
		this._disposables.dispose();
		this._sessionDisposable.dispose();
	}

	private _update(): void {

		let control = this._editorService.activeTextEditorControl;
		let codeEditor: ICodeEditor | undefined = undefined;
		if (isCodeEditor(control)) {
			codeEditor = control;
		} else if (isDiffEditor(control)) {
			codeEditor = control.getModifiedEditor();
		}

		if (!codeEditor || !codeEditor.hasModel()) {
			this._lastState = undefined;
			this._callback(undefined, undefined);
			return;
		}

		let thisState = new RequestState(
			codeEditor.getId(),
			codeEditor.getModel().id,
			codeEditor.getModel().getVersionId(),
			this._featureRegistry.all(codeEditor.getModel()).length
		);

		if (this._lastState && thisState.equals(this._lastState)) {
			// prevent unnecessary changes...
			return;
		}
		this._lastState = thisState;
		this._callback(codeEditor, undefined);

		let handle: any;
		let contentListener = codeEditor.onDidChangeModelContent(event => {
			clearTimeout(handle);
			const timeout = OutlineModel.getRequestDelay(codeEditor!.getModel());
			handle = setTimeout(() => this._callback(codeEditor!, event), timeout);
		});
		let modeListener = codeEditor.onDidChangeModelLanguage(_ => {
			this._callback(codeEditor!, undefined);
		});
		let disposeListener = codeEditor.onDidDispose(() => {
			this._callback(undefined, undefined);
		});
		this._sessionDisposable.value = {
			dispose() {
				contentListener.dispose();
				clearTimeout(handle);
				modeListener.dispose();
				disposeListener.dispose();
			}
		};
	}
}


class OutlineViewState {

	private _followCursor = false;
	private _filterOnType = true;
	private _sortBy = OutlineSortOrder.ByKind;

	private readonly _onDidChange = new Emitter<{ followCursor?: boolean, sortBy?: boolean, filterOnType?: boolean }>();
	readonly onDidChange = this._onDidChange.event;

	set followCursor(value: boolean) {
		if (value !== this._followCursor) {
			this._followCursor = value;
			this._onDidChange.fire({ followCursor: true });
		}
	}

	get followCursor(): boolean {
		return this._followCursor;
	}

	get filterOnType() {
		return this._filterOnType;
	}

	set filterOnType(value) {
		if (value !== this._filterOnType) {
			this._filterOnType = value;
			this._onDidChange.fire({ filterOnType: true });
		}
	}

	set sortBy(value: OutlineSortOrder) {
		if (value !== this._sortBy) {
			this._sortBy = value;
			this._onDidChange.fire({ sortBy: true });
		}
	}

	get sortBy(): OutlineSortOrder {
		return this._sortBy;
	}

	persist(storageService: IStorageService): void {
		storageService.store('outline/state', JSON.stringify({
			followCursor: this.followCursor,
			sortBy: this.sortBy,
			filterOnType: this.filterOnType,
		}), StorageScope.WORKSPACE, StorageTarget.USER);
	}

	restore(storageService: IStorageService): void {
		let raw = storageService.get('outline/state', StorageScope.WORKSPACE);
		if (!raw) {
			return;
		}
		let data: any;
		try {
			data = JSON.parse(raw);
		} catch (e) {
			return;
		}
		this.followCursor = data.followCursor;
		this.sortBy = data.sortBy;
		if (typeof data.filterOnType === 'boolean') {
			this.filterOnType = data.filterOnType;
		}
	}
}

export class OutlinePane extends ViewPane {

	private _disposables = new DisposableStore();

	private _editorDisposables = new DisposableStore();
	private _outlineViewState = new OutlineViewState();
	private _requestOracle?: RequestOracle;
	private _domNode!: HTMLElement;
	private _message!: HTMLDivElement;
	private _progressBar!: ProgressBar;
	private _tree!: WorkbenchDataTree<OutlineModel, OutlineItem, FuzzyScore>;
	private _treeDataSource!: OutlineDataSource;
	private _treeRenderer!: OutlineElementRenderer;
	private _treeComparator!: OutlineItemComparator;
	private _treeFilter!: OutlineFilter;
	private _treeStates = new LRUCache<string, IDataTreeViewState>(10);

	private readonly _ctxFocused: IContextKey<boolean>;
	private readonly _ctxFiltered: IContextKey<boolean>;
	private readonly _ctxFollowsCursor: IContextKey<boolean>;
	private readonly _ctxFilterOnType: IContextKey<boolean>;
	private readonly _ctxSortMode: IContextKey<OutlineSortOrder>;

	constructor(
		options: IViewletViewOptions,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IThemeService private readonly _themeService: IThemeService,
		@IStorageService private readonly _storageService: IStorageService,
		@ICodeEditorService private readonly _editorService: ICodeEditorService,
		@IMarkerDecorationsService private readonly _markerDecorationService: IMarkerDecorationsService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super(options, keybindingService, contextMenuService, _configurationService, contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, telemetryService);
		this._outlineViewState.restore(this._storageService);
		this._ctxFocused = OutlineViewFocused.bindTo(contextKeyService);
		this._ctxFiltered = OutlineViewFiltered.bindTo(contextKeyService);
		this._disposables.add(this.onDidFocus(_ => this._ctxFocused.set(true)));
		this._disposables.add(this.onDidBlur(_ => this._ctxFocused.set(false)));


		this._ctxFollowsCursor = _ctxFollowsCursor.bindTo(contextKeyService);
		this._ctxFilterOnType = _ctxFilterOnType.bindTo(contextKeyService);
		this._ctxSortMode = _ctxSortMode.bindTo(contextKeyService);
		const viewStateToContext = () => {
			this._ctxFollowsCursor.set(this._outlineViewState.followCursor);
			this._ctxFilterOnType.set(this._outlineViewState.filterOnType);
			this._ctxSortMode.set(this._outlineViewState.sortBy);
		};
		viewStateToContext();
		this._outlineViewState.onDidChange(viewStateToContext, this);
	}

	dispose(): void {
		this._disposables.dispose();
		this._requestOracle?.dispose();
		this._editorDisposables.dispose();
		super.dispose();
	}

	focus(): void {
		if (this._tree) {
			this._tree.domFocus();
		}
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this._domNode = container;
		container.classList.add('outline-pane');

		let progressContainer = dom.$('.outline-progress');
		this._message = dom.$('.outline-message');

		this._progressBar = new ProgressBar(progressContainer);
		this._register(attachProgressBarStyler(this._progressBar, this._themeService));

		let treeContainer = dom.$('.outline-tree');
		dom.append(
			container,
			progressContainer, this._message, treeContainer
		);

		this._treeRenderer = this._instantiationService.createInstance(OutlineElementRenderer);
		this._treeDataSource = new OutlineDataSource();
		this._treeComparator = new OutlineItemComparator(this._outlineViewState.sortBy);
		this._treeFilter = this._instantiationService.createInstance(OutlineFilter, 'outline');
		this._tree = <WorkbenchDataTree<OutlineModel, OutlineItem, FuzzyScore>>this._instantiationService.createInstance(
			WorkbenchDataTree,
			'OutlinePane',
			treeContainer,
			new OutlineVirtualDelegate(),
			[new OutlineGroupRenderer(), this._treeRenderer],
			// https://github.com/microsoft/TypeScript/issues/32526
			this._treeDataSource as IDataSource<OutlineModel, OutlineItem>,
			{
				expandOnlyOnTwistieClick: true,
				multipleSelectionSupport: false,
				filterOnType: this._outlineViewState.filterOnType,
				sorter: this._treeComparator,
				filter: this._treeFilter,
				identityProvider: new OutlineIdentityProvider(),
				keyboardNavigationLabelProvider: new OutlineNavigationLabelProvider(),
				accessibilityProvider: new OutlineAccessibilityProvider(localize('outline', "Outline")),
				hideTwistiesOfChildlessElements: true,
				overrideStyles: {
					listBackground: this.getBackgroundColor()
				},
				openOnSingleClick: true
			}
		);


		this._disposables.add(this._tree);
		this._disposables.add(this._outlineViewState.onDidChange(this._onDidChangeUserState, this));
		this._disposables.add(this.viewDescriptorService.onDidChangeLocation(({ views }) => {
			if (views.some(v => v.id === this.id)) {
				this._tree.updateOptions({ overrideStyles: { listBackground: this.getBackgroundColor() } });
			}
		}));

		// override the globally defined behaviour
		this._tree.updateOptions({
			filterOnType: this._outlineViewState.filterOnType
		});

		// feature: filter on type - keep tree and menu in sync
		this._register(this._tree.onDidUpdateOptions(e => {
			this._outlineViewState.filterOnType = Boolean(e.filterOnType);
		}));

		// feature: expand all nodes when filtering (not when finding)
		let viewState: IDataTreeViewState | undefined;
		this._register(this._tree.onDidChangeTypeFilterPattern(pattern => {
			if (!this._tree.options.filterOnType) {
				return;
			}
			if (!viewState && pattern) {
				viewState = this._tree.getViewState();
				this._tree.expandAll();
			} else if (!pattern && viewState) {
				this._tree.setInput(this._tree.getInput()!, viewState);
				viewState = undefined;
			}
		}));

		// feature: toggle icons
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(OutlineConfigKeys.icons)) {
				this._tree.updateChildren();
			}
			if (e.affectsConfiguration('outline')) {
				this._tree.refilter();
			}
		}));

		this._register(this.onDidChangeBodyVisibility(visible => {
			if (visible && !this._requestOracle) {
				this._requestOracle = this._instantiationService.createInstance(RequestOracle, (editor, event) => this._doUpdate(editor, event), DocumentSymbolProviderRegistry);
			} else if (!visible) {
				this._requestOracle?.dispose();
				this._requestOracle = undefined;
				this._doUpdate(undefined, undefined);
			}
		}));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._tree.layout(height, width);
	}

	collapseAll(): void {
		this._tree.collapseAll();
	}

	get outlineViewState() {
		return this._outlineViewState;
	}

	private _onDidChangeUserState(e: { followCursor?: boolean, sortBy?: boolean, filterOnType?: boolean }) {
		this._outlineViewState.persist(this._storageService);

		if (e.sortBy) {
			this._treeComparator.type = this._outlineViewState.sortBy;
			this._tree.resort();
		}
		if (e.filterOnType) {
			this._tree.updateOptions({
				filterOnType: this._outlineViewState.filterOnType
			});
		}
	}

	private _showMessage(message: string) {
		this._domNode.classList.add('message');
		this._tree.setInput(undefined!);
		this._progressBar.stop().hide();
		this._message.innerText = message;
	}

	private static _createOutlineModel(model: ITextModel, disposables: DisposableStore): Promise<OutlineModel | undefined> {
		let promise = createCancelablePromise(token => OutlineModel.create(model, token));
		disposables.add({ dispose() { promise.cancel(); } });
		return promise.catch(err => {
			if (!isPromiseCanceledError(err)) {
				throw err;
			}
			return undefined;
		});
	}

	private async _doUpdate(editor: ICodeEditor | undefined, event: IModelContentChangedEvent | undefined): Promise<void> {
		this._editorDisposables.clear();


		const oldModel = this._tree.getInput();

		// persist state
		if (oldModel) {
			this._treeStates.set(oldModel.uri.toString(), this._tree.getViewState());
		}

		if (!editor || !editor.hasModel() || !DocumentSymbolProviderRegistry.has(editor.getModel())) {
			return this._showMessage(localize('no-editor', "The active editor cannot provide outline information."));
		}

		const textModel = editor.getModel();

		let loadingMessage: IDisposable | undefined;
		if (!oldModel) {
			loadingMessage = new TimeoutTimer(
				() => this._showMessage(localize('loading', "Loading document symbols for '{0}'...", basename(textModel.uri))),
				100
			);
		}

		const requestDelay = OutlineModel.getRequestDelay(textModel);
		this._progressBar.infinite().show(requestDelay);

		const createdModel = await OutlinePane._createOutlineModel(textModel, this._editorDisposables);
		loadingMessage?.dispose();
		if (!createdModel) {
			return;
		}

		let newModel = createdModel;
		if (TreeElement.empty(newModel)) {
			return this._showMessage(localize('no-symbols', "No symbols found in document '{0}'", basename(textModel.uri)));
		}

		this._domNode.classList.remove('message');

		if (event && oldModel && textModel.getLineCount() >= 25) {
			// heuristic: when the symbols-to-lines ratio changes by 50% between edits
			// wait a little (and hope that the next change isn't as drastic).
			let newSize = TreeElement.size(newModel);
			let newLength = textModel.getValueLength();
			let newRatio = newSize / newLength;
			let oldSize = TreeElement.size(oldModel);
			let oldLength = newLength - event.changes.reduce((prev, value) => prev + value.rangeLength, 0);
			let oldRatio = oldSize / oldLength;
			if (newRatio <= oldRatio * 0.5 || newRatio >= oldRatio * 1.5) {

				let waitPromise = new Promise<boolean>(resolve => {
					let handle: any = setTimeout(() => {
						handle = undefined;
						resolve(true);
					}, 2000);
					this._disposables.add({
						dispose() {
							clearTimeout(handle);
							resolve(false);
						}
					});
				});

				if (!await waitPromise) {
					return;
				}
			}
		}

		this._progressBar.stop().hide();

		if (oldModel && oldModel.merge(newModel)) {
			this._tree.updateChildren();
			newModel = oldModel;
		} else {
			let state = this._treeStates.get(newModel.uri.toString());
			this._tree.setInput(newModel, state);
		}

		this._editorDisposables.add(toDisposable(() => this._ctxFiltered.reset()));

		// feature: reveal outline selection in editor
		// on change -> reveal/select defining range
		this._editorDisposables.add(this._tree.onDidOpen(e => {
			if (!(e.element instanceof OutlineElement)) {
				return;
			}

			this._revealTreeSelection(newModel, e.element, !!e.editorOptions.preserveFocus, !!e.editorOptions.pinned, e.sideBySide);
		}));

		// feature: reveal editor selection in outline
		this._revealEditorSelection(newModel, editor.getSelection());
		const versionIdThen = textModel.getVersionId();
		this._editorDisposables.add(editor.onDidChangeCursorSelection(e => {
			// first check if the document has changed and stop revealing the
			// cursor position iff it has -> we will update/recompute the
			// outline view then anyways
			if (!textModel.isDisposed() && textModel.getVersionId() === versionIdThen) {
				this._revealEditorSelection(newModel, e.selection);
			}
		}));

		// feature: show markers in outline
		const updateMarker = (model: ITextModel, ignoreEmpty?: boolean) => {
			if (!this._configurationService.getValue(OutlineConfigKeys.problemsEnabled)) {
				return;
			}
			if (model !== textModel) {
				return;
			}
			const markers: IOutlineMarker[] = [];
			for (const [range, marker] of this._markerDecorationService.getLiveMarkers(textModel)) {
				if (marker.severity === MarkerSeverity.Error || marker.severity === MarkerSeverity.Warning) {
					markers.push({ ...range, severity: marker.severity });
				}
			}
			if (markers.length > 0 || !ignoreEmpty) {
				newModel.updateMarker(markers);
				this._tree.updateChildren();
			}
		};
		updateMarker(textModel, true);
		this._editorDisposables.add(Event.debounce(this._markerDecorationService.onDidChangeMarker, (_, e) => e, 64)(updateMarker));

		this._editorDisposables.add(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(OutlineConfigKeys.problemsBadges) || e.affectsConfiguration(OutlineConfigKeys.problemsColors)) {
				this._tree.updateChildren();
				return;
			}
			if (!e.affectsConfiguration(OutlineConfigKeys.problemsEnabled)) {
				return;
			}
			if (!this._configurationService.getValue(OutlineConfigKeys.problemsEnabled)) {
				newModel.updateMarker([]);
				this._tree.updateChildren();
			} else {
				updateMarker(textModel, true);
			}
		}));
	}

	private async _revealTreeSelection(model: OutlineModel, element: OutlineElement, preserveFocus: boolean, pinned: boolean, aside: boolean): Promise<void> {
		await this._editorService.openCodeEditor(
			{
				resource: model.uri,
				options: {
					preserveFocus,
					pinned,
					selection: Range.collapseToStart(element.symbol.selectionRange),
					selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport,
				}
			},
			this._editorService.getActiveCodeEditor(),
			aside
		);
	}

	private _revealEditorSelection(model: OutlineModel, selection: Selection): void {
		if (!this._outlineViewState.followCursor || !this._tree.getInput() || !selection) {
			return;
		}
		let [first] = this._tree.getSelection();
		let item = model.getItemEnclosingPosition({
			lineNumber: selection.selectionStartLineNumber,
			column: selection.selectionStartColumn
		}, first instanceof OutlineElement ? first : undefined);
		if (!item) {
			// nothing to reveal
			return;
		}
		let top = this._tree.getRelativeTop(item);
		if (top === null) {
			this._tree.reveal(item, 0.5);
		}
		this._tree.setFocus([item]);
		this._tree.setSelection([item]);
	}
}


const _ctxFollowsCursor = new RawContextKey('outlineFollowsCursor', false);
const _ctxFilterOnType = new RawContextKey('outlineFiltersOnType', false);
const _ctxSortMode = new RawContextKey<OutlineSortOrder>('outlineSortMode', OutlineSortOrder.ByPosition);

// --- commands

registerAction2(class Collapse extends ViewAction<OutlinePane> {
	constructor() {
		super({
			viewId: OutlineViewId,
			id: 'outline.collapse',
			title: localize('collapse', "Collapse All"),
			f1: false,
			icon: Codicon.collapseAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyEqualsExpr.create('view', OutlineViewId)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: OutlinePane) {
		view.collapseAll();
	}
});

registerAction2(class FollowCursor extends ViewAction<OutlinePane> {
	constructor() {
		super({
			viewId: OutlineViewId,
			id: 'outline.followCursor',
			title: localize('followCur', "Follow Cursor"),
			f1: false,
			toggled: _ctxFollowsCursor,
			menu: {
				id: MenuId.ViewTitle,
				group: 'config',
				order: 1,
				when: ContextKeyEqualsExpr.create('view', OutlineViewId)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: OutlinePane) {
		view.outlineViewState.followCursor = !view.outlineViewState.followCursor;
	}
});

registerAction2(class FilterOnType extends ViewAction<OutlinePane> {
	constructor() {
		super({
			viewId: OutlineViewId,
			id: 'outline.filterOnType',
			title: localize('filterOnType', "Filter on Type"),
			f1: false,
			toggled: _ctxFilterOnType,
			menu: {
				id: MenuId.ViewTitle,
				group: 'config',
				order: 2,
				when: ContextKeyEqualsExpr.create('view', OutlineViewId)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: OutlinePane) {
		view.outlineViewState.filterOnType = !view.outlineViewState.filterOnType;
	}
});

registerAction2(class SortByPosition extends ViewAction<OutlinePane> {
	constructor() {
		super({
			viewId: OutlineViewId,
			id: 'outline.sortByPosition',
			title: localize('sortByPosition', "Sort By: Position"),
			f1: false,
			toggled: _ctxSortMode.isEqualTo(OutlineSortOrder.ByPosition),
			menu: {
				id: MenuId.ViewTitle,
				group: 'sort',
				order: 1,
				when: ContextKeyEqualsExpr.create('view', OutlineViewId)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: OutlinePane) {
		view.outlineViewState.sortBy = OutlineSortOrder.ByPosition;
	}
});

registerAction2(class SortByName extends ViewAction<OutlinePane> {
	constructor() {
		super({
			viewId: OutlineViewId,
			id: 'outline.sortByName',
			title: localize('sortByName', "Sort By: Name"),
			f1: false,
			toggled: _ctxSortMode.isEqualTo(OutlineSortOrder.ByName),
			menu: {
				id: MenuId.ViewTitle,
				group: 'sort',
				order: 2,
				when: ContextKeyEqualsExpr.create('view', OutlineViewId)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: OutlinePane) {
		view.outlineViewState.sortBy = OutlineSortOrder.ByName;
	}
});

registerAction2(class SortByKind extends ViewAction<OutlinePane> {
	constructor() {
		super({
			viewId: OutlineViewId,
			id: 'outline.sortByKind',
			title: localize('sortByKind', "Sort By: Category"),
			f1: false,
			toggled: _ctxSortMode.isEqualTo(OutlineSortOrder.ByKind),
			menu: {
				id: MenuId.ViewTitle,
				group: 'sort',
				order: 3,
				when: ContextKeyEqualsExpr.create('view', OutlineViewId)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: OutlinePane) {
		view.outlineViewState.sortBy = OutlineSortOrder.ByKind;
	}
});
