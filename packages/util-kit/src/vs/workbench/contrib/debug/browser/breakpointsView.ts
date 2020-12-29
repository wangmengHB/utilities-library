/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as resources from 'vs/base/common/resources';
import * as dom from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { IDebugService, IBreakpoint, CONTEXT_BREAKPOINTS_FOCUSED, State, DEBUG_SCHEME, IFunctionBreakpoint, IExceptionBreakpoint, IEnablement, IDebugModel, IDataBreakpoint, BREAKPOINTS_VIEW_ID, CONTEXT_BREAKPOINT_ITEM_TYPE, CONTEXT_EXCEPTION_BREAKPOINT_SUPPORTS_CONDITION, CONTEXT_BREAKPOINTS_EXIST, CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_IN_DEBUG_MODE, IBaseBreakpoint, IBreakpointEditorContribution, BREAKPOINT_EDITOR_CONTRIBUTION_ID } from 'vs/workbench/contrib/debug/common/debug';
import { ExceptionBreakpoint, FunctionBreakpoint, Breakpoint, DataBreakpoint } from 'vs/workbench/contrib/debug/common/debugModel';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IThemeService, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { Constants } from 'vs/base/common/uint';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IListVirtualDelegate, IListContextMenuEvent, IListRenderer } from 'vs/base/browser/ui/list/list';
import { IEditorPane } from 'vs/workbench/common/editor';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { WorkbenchList, ListResourceNavigator } from 'vs/platform/list/browser/listService';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { ILabelService } from 'vs/platform/label/common/label';
import { IContextKeyService, ContextKeyEqualsExpr, IContextKey, ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { Gesture } from 'vs/base/browser/touch';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { TextEditorSelectionRevealType } from 'vs/platform/editor/common/editor';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import * as icons from 'vs/workbench/contrib/debug/browser/debugIcons';
import { registerAction2, Action2, MenuId, IMenu, IMenuService } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { isCodeEditor } from 'vs/editor/browser/editorBrowser';

const $ = dom.$;

function createCheckbox(): HTMLInputElement {
	const checkbox = <HTMLInputElement>$('input');
	checkbox.type = 'checkbox';
	checkbox.tabIndex = -1;
	Gesture.ignoreTarget(checkbox);

	return checkbox;
}

const MAX_VISIBLE_BREAKPOINTS = 9;
export function getExpandedBodySize(model: IDebugModel, countLimit: number): number {
	const length = model.getBreakpoints().length + model.getExceptionBreakpoints().length + model.getFunctionBreakpoints().length + model.getDataBreakpoints().length;
	return Math.min(countLimit, length) * 22;
}
type BreakpointItem = IBreakpoint | IFunctionBreakpoint | IDataBreakpoint | IExceptionBreakpoint;

export class BreakpointsView extends ViewPane {

	private list!: WorkbenchList<BreakpointItem>;
	private needsRefresh = false;
	private ignoreLayout = false;
	private menu: IMenu;
	private breakpointItemType: IContextKey<string | undefined>;
	private exceptionBreakpointSupportsCondition: IContextKey<boolean>;

	constructor(
		options: IViewletViewOptions,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IDebugService private readonly debugService: IDebugService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IEditorService private readonly editorService: IEditorService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConfigurationService configurationService: IConfigurationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@ILabelService private readonly labelService: ILabelService,
		@IMenuService menuService: IMenuService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this.menu = menuService.createMenu(MenuId.DebugBreakpointsContext, contextKeyService);
		this._register(this.menu);
		this.breakpointItemType = CONTEXT_BREAKPOINT_ITEM_TYPE.bindTo(contextKeyService);
		this.exceptionBreakpointSupportsCondition = CONTEXT_EXCEPTION_BREAKPOINT_SUPPORTS_CONDITION.bindTo(contextKeyService);
		this._register(this.debugService.getModel().onDidChangeBreakpoints(() => this.onBreakpointsChange()));
		this._register(this.debugService.getViewModel().onDidSelectBreakpoint(breakpoint => {
			if (breakpoint) {
				// Only react when a new breakpoint is selected - to reduce refresh, since other times a refresh is not needed
				this.onBreakpointsChange();
			}
		}));
	}

	public renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.element.classList.add('debug-pane');
		container.classList.add('debug-breakpoints');
		const delegate = new BreakpointsDelegate(this.debugService);

		this.list = <WorkbenchList<BreakpointItem>>this.instantiationService.createInstance(WorkbenchList, 'Breakpoints', container, delegate, [
			this.instantiationService.createInstance(BreakpointsRenderer),
			new ExceptionBreakpointsRenderer(this.debugService),
			new ExceptionBreakpointInputRenderer(this.debugService, this.contextViewService, this.themeService),
			this.instantiationService.createInstance(FunctionBreakpointsRenderer),
			this.instantiationService.createInstance(DataBreakpointsRenderer),
			new FunctionBreakpointInputRenderer(this.debugService, this.contextViewService, this.themeService, this.labelService)
		], {
			identityProvider: { getId: (element: IEnablement) => element.getId() },
			multipleSelectionSupport: false,
			keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e: IEnablement) => e },
			accessibilityProvider: new BreakpointsAccessibilityProvider(this.debugService, this.labelService),
			overrideStyles: {
				listBackground: this.getBackgroundColor()
			}
		});

		CONTEXT_BREAKPOINTS_FOCUSED.bindTo(this.list.contextKeyService);

		this._register(this.list.onContextMenu(this.onListContextMenu, this));

		this.list.onMouseMiddleClick(async ({ element }) => {
			if (element instanceof Breakpoint) {
				await this.debugService.removeBreakpoints(element.getId());
			} else if (element instanceof FunctionBreakpoint) {
				await this.debugService.removeFunctionBreakpoints(element.getId());
			} else if (element instanceof DataBreakpoint) {
				await this.debugService.removeDataBreakpoints(element.getId());
			}
		});

		const resourceNavigator = this._register(new ListResourceNavigator(this.list, { configurationService: this.configurationService }));
		this._register(resourceNavigator.onDidOpen(async e => {
			if (!e.element) {
				return;
			}

			if (e.browserEvent instanceof MouseEvent && e.browserEvent.button === 1) { // middle click
				return;
			}

			if (e.element instanceof Breakpoint) {
				openBreakpointSource(e.element, e.sideBySide, e.editorOptions.preserveFocus || false, e.editorOptions.pinned || !e.editorOptions.preserveFocus, this.debugService, this.editorService);
			}
			if (e.browserEvent instanceof MouseEvent && e.browserEvent.detail === 2 && e.element instanceof FunctionBreakpoint && e.element !== this.debugService.getViewModel().getSelectedBreakpoint()) {
				// double click
				this.debugService.getViewModel().setSelectedBreakpoint(e.element);
			}
		}));

		this.list.splice(0, this.list.length, this.elements);

		this._register(this.onDidChangeBodyVisibility(visible => {
			if (visible && this.needsRefresh) {
				this.onBreakpointsChange();
			}
		}));

		const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id)!)!;
		this._register(containerModel.onDidChangeAllViewDescriptors(() => {
			this.updateSize();
		}));
	}

	public focus(): void {
		super.focus();
		if (this.list) {
			this.list.domFocus();
		}
	}

	protected layoutBody(height: number, width: number): void {
		if (this.ignoreLayout) {
			return;
		}

		super.layoutBody(height, width);
		if (this.list) {
			this.list.layout(height, width);
		}
		try {
			this.ignoreLayout = true;
			this.updateSize();
		} finally {
			this.ignoreLayout = false;
		}
	}

	private onListContextMenu(e: IListContextMenuEvent<IEnablement>): void {
		const element = e.element;
		const type = element instanceof Breakpoint ? 'breakpoint' : element instanceof ExceptionBreakpoint ? 'exceptionBreakpoint' :
			element instanceof FunctionBreakpoint ? 'functionBreakpoint' : element instanceof DataBreakpoint ? 'dataBreakpoint' : undefined;
		this.breakpointItemType.set(type);
		this.exceptionBreakpointSupportsCondition.set(element instanceof ExceptionBreakpoint && element.supportsCondition);

		const actions: IAction[] = [];
		const actionsDisposable = createAndFillInContextMenuActions(this.menu, { arg: e.element, shouldForwardArgs: false }, actions);

		this.contextMenuService.showContextMenu({
			getAnchor: () => e.anchor,
			getActions: () => actions,
			getActionsContext: () => element,
			onHide: () => dispose(actionsDisposable)
		});
	}

	private updateSize(): void {
		const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id)!)!;

		// Adjust expanded body size
		this.minimumBodySize = this.orientation === Orientation.VERTICAL ? getExpandedBodySize(this.debugService.getModel(), MAX_VISIBLE_BREAKPOINTS) : 170;
		this.maximumBodySize = this.orientation === Orientation.VERTICAL && containerModel.visibleViewDescriptors.length > 1 ? getExpandedBodySize(this.debugService.getModel(), Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
	}

	private onBreakpointsChange(): void {
		if (this.isBodyVisible()) {
			this.updateSize();
			if (this.list) {
				const lastFocusIndex = this.list.getFocus()[0];
				// Check whether focused element was removed
				const needsRefocus = lastFocusIndex && !this.elements.includes(this.list.element(lastFocusIndex));
				this.list.splice(0, this.list.length, this.elements);
				this.needsRefresh = false;
				if (needsRefocus) {
					this.list.focusNth(Math.min(lastFocusIndex, this.list.length - 1));
				}
			}
		} else {
			this.needsRefresh = true;
		}
	}

	private get elements(): BreakpointItem[] {
		const model = this.debugService.getModel();
		const elements = (<ReadonlyArray<IEnablement>>model.getExceptionBreakpoints()).concat(model.getFunctionBreakpoints()).concat(model.getDataBreakpoints()).concat(model.getBreakpoints());

		return elements as BreakpointItem[];
	}
}

class BreakpointsDelegate implements IListVirtualDelegate<BreakpointItem> {

	constructor(private debugService: IDebugService) {
		// noop
	}

	getHeight(_element: BreakpointItem): number {
		return 22;
	}

	getTemplateId(element: BreakpointItem): string {
		if (element instanceof Breakpoint) {
			return BreakpointsRenderer.ID;
		}
		if (element instanceof FunctionBreakpoint) {
			const selected = this.debugService.getViewModel().getSelectedBreakpoint();
			if (!element.name || (selected && selected.getId() === element.getId())) {
				return FunctionBreakpointInputRenderer.ID;
			}

			return FunctionBreakpointsRenderer.ID;
		}
		if (element instanceof ExceptionBreakpoint) {
			const selected = this.debugService.getViewModel().getSelectedBreakpoint();
			if (selected && selected.getId() === element.getId()) {
				return ExceptionBreakpointInputRenderer.ID;
			}
			return ExceptionBreakpointsRenderer.ID;
		}
		if (element instanceof DataBreakpoint) {
			return DataBreakpointsRenderer.ID;
		}

		return '';
	}
}

interface IBaseBreakpointTemplateData {
	breakpoint: HTMLElement;
	name: HTMLElement;
	checkbox: HTMLInputElement;
	context: BreakpointItem;
	toDispose: IDisposable[];
}

interface IBaseBreakpointWithIconTemplateData extends IBaseBreakpointTemplateData {
	icon: HTMLElement;
}

interface IBreakpointTemplateData extends IBaseBreakpointWithIconTemplateData {
	lineNumber: HTMLElement;
	filePath: HTMLElement;
}

interface IExceptionBreakpointTemplateData extends IBaseBreakpointTemplateData {
	condition: HTMLElement;
}

interface IFunctionBreakpointInputTemplateData {
	inputBox: InputBox;
	checkbox: HTMLInputElement;
	icon: HTMLElement;
	breakpoint: IFunctionBreakpoint;
	reactedOnEvent: boolean;
	toDispose: IDisposable[];
}

interface IExceptionBreakpointInputTemplateData {
	inputBox: InputBox;
	checkbox: HTMLInputElement;
	breakpoint: IExceptionBreakpoint;
	reactedOnEvent: boolean;
	toDispose: IDisposable[];
}

class BreakpointsRenderer implements IListRenderer<IBreakpoint, IBreakpointTemplateData> {

	constructor(
		@IDebugService private readonly debugService: IDebugService,
		@ILabelService private readonly labelService: ILabelService
	) {
		// noop
	}

	static readonly ID = 'breakpoints';

	get templateId() {
		return BreakpointsRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBreakpointTemplateData {
		const data: IBreakpointTemplateData = Object.create(null);
		data.breakpoint = dom.append(container, $('.breakpoint'));

		data.icon = $('.icon');
		data.checkbox = createCheckbox();
		data.toDispose = [];
		data.toDispose.push(dom.addStandardDisposableListener(data.checkbox, 'change', (e) => {
			this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
		}));

		dom.append(data.breakpoint, data.icon);
		dom.append(data.breakpoint, data.checkbox);

		data.name = dom.append(data.breakpoint, $('span.name'));

		data.filePath = dom.append(data.breakpoint, $('span.file-path'));
		const lineNumberContainer = dom.append(data.breakpoint, $('.line-number-container'));
		data.lineNumber = dom.append(lineNumberContainer, $('span.line-number.monaco-count-badge'));

		return data;
	}

	renderElement(breakpoint: IBreakpoint, index: number, data: IBreakpointTemplateData): void {
		data.context = breakpoint;
		data.breakpoint.classList.toggle('disabled', !this.debugService.getModel().areBreakpointsActivated());

		data.name.textContent = resources.basenameOrAuthority(breakpoint.uri);
		data.lineNumber.textContent = breakpoint.lineNumber.toString();
		if (breakpoint.column) {
			data.lineNumber.textContent += `:${breakpoint.column}`;
		}
		data.filePath.textContent = this.labelService.getUriLabel(resources.dirname(breakpoint.uri), { relative: true });
		data.checkbox.checked = breakpoint.enabled;

		const { message, icon } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), breakpoint, this.labelService);
		data.icon.className = ThemeIcon.asClassName(icon);
		data.breakpoint.title = breakpoint.message || message || '';

		const debugActive = this.debugService.state === State.Running || this.debugService.state === State.Stopped;
		if (debugActive && !breakpoint.verified) {
			data.breakpoint.classList.add('disabled');
		}
	}

	disposeTemplate(templateData: IBreakpointTemplateData): void {
		dispose(templateData.toDispose);
	}
}

class ExceptionBreakpointsRenderer implements IListRenderer<IExceptionBreakpoint, IExceptionBreakpointTemplateData> {

	constructor(
		private debugService: IDebugService
	) {
		// noop
	}

	static readonly ID = 'exceptionbreakpoints';

	get templateId() {
		return ExceptionBreakpointsRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IExceptionBreakpointTemplateData {
		const data: IExceptionBreakpointTemplateData = Object.create(null);
		data.breakpoint = dom.append(container, $('.breakpoint'));

		data.checkbox = createCheckbox();
		data.toDispose = [];
		data.toDispose.push(dom.addStandardDisposableListener(data.checkbox, 'change', (e) => {
			this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
		}));

		dom.append(data.breakpoint, data.checkbox);

		data.name = dom.append(data.breakpoint, $('span.name'));
		data.condition = dom.append(data.breakpoint, $('span.condition'));
		data.breakpoint.classList.add('exception');

		return data;
	}

	renderElement(exceptionBreakpoint: IExceptionBreakpoint, index: number, data: IExceptionBreakpointTemplateData): void {
		data.context = exceptionBreakpoint;
		data.name.textContent = exceptionBreakpoint.label || `${exceptionBreakpoint.filter} exceptions`;
		data.breakpoint.title = data.name.textContent;
		data.checkbox.checked = exceptionBreakpoint.enabled;
		data.condition.textContent = exceptionBreakpoint.condition || '';
		data.condition.title = localize('expressionCondition', "Expression condition: {0}", exceptionBreakpoint.condition);
	}

	disposeTemplate(templateData: IExceptionBreakpointTemplateData): void {
		dispose(templateData.toDispose);
	}
}

class FunctionBreakpointsRenderer implements IListRenderer<FunctionBreakpoint, IBaseBreakpointWithIconTemplateData> {

	constructor(
		@IDebugService private readonly debugService: IDebugService,
		@ILabelService private readonly labelService: ILabelService
	) {
		// noop
	}

	static readonly ID = 'functionbreakpoints';

	get templateId() {
		return FunctionBreakpointsRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBaseBreakpointWithIconTemplateData {
		const data: IBreakpointTemplateData = Object.create(null);
		data.breakpoint = dom.append(container, $('.breakpoint'));

		data.icon = $('.icon');
		data.checkbox = createCheckbox();
		data.toDispose = [];
		data.toDispose.push(dom.addStandardDisposableListener(data.checkbox, 'change', (e) => {
			this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
		}));

		dom.append(data.breakpoint, data.icon);
		dom.append(data.breakpoint, data.checkbox);

		data.name = dom.append(data.breakpoint, $('span.name'));

		return data;
	}

	renderElement(functionBreakpoint: FunctionBreakpoint, _index: number, data: IBaseBreakpointWithIconTemplateData): void {
		data.context = functionBreakpoint;
		data.name.textContent = functionBreakpoint.name;
		const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), functionBreakpoint, this.labelService);
		data.icon.className = ThemeIcon.asClassName(icon);
		data.icon.title = message ? message : '';
		data.checkbox.checked = functionBreakpoint.enabled;
		data.breakpoint.title = message ? message : '';

		// Mark function breakpoints as disabled if deactivated or if debug type does not support them #9099
		const session = this.debugService.getViewModel().focusedSession;
		data.breakpoint.classList.toggle('disabled', (session && !session.capabilities.supportsFunctionBreakpoints) || !this.debugService.getModel().areBreakpointsActivated());
		if (session && !session.capabilities.supportsFunctionBreakpoints) {
			data.breakpoint.title = localize('functionBreakpointsNotSupported', "Function breakpoints are not supported by this debug type");
		}
	}

	disposeTemplate(templateData: IBaseBreakpointWithIconTemplateData): void {
		dispose(templateData.toDispose);
	}
}

class DataBreakpointsRenderer implements IListRenderer<DataBreakpoint, IBaseBreakpointWithIconTemplateData> {

	constructor(
		@IDebugService private readonly debugService: IDebugService,
		@ILabelService private readonly labelService: ILabelService
	) {
		// noop
	}

	static readonly ID = 'databreakpoints';

	get templateId() {
		return DataBreakpointsRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBaseBreakpointWithIconTemplateData {
		const data: IBreakpointTemplateData = Object.create(null);
		data.breakpoint = dom.append(container, $('.breakpoint'));

		data.icon = $('.icon');
		data.checkbox = createCheckbox();
		data.toDispose = [];
		data.toDispose.push(dom.addStandardDisposableListener(data.checkbox, 'change', (e) => {
			this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
		}));

		dom.append(data.breakpoint, data.icon);
		dom.append(data.breakpoint, data.checkbox);

		data.name = dom.append(data.breakpoint, $('span.name'));

		return data;
	}

	renderElement(dataBreakpoint: DataBreakpoint, _index: number, data: IBaseBreakpointWithIconTemplateData): void {
		data.context = dataBreakpoint;
		data.name.textContent = dataBreakpoint.description;
		const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), dataBreakpoint, this.labelService);
		data.icon.className = ThemeIcon.asClassName(icon);
		data.icon.title = message ? message : '';
		data.checkbox.checked = dataBreakpoint.enabled;
		data.breakpoint.title = message ? message : '';

		// Mark function breakpoints as disabled if deactivated or if debug type does not support them #9099
		const session = this.debugService.getViewModel().focusedSession;
		data.breakpoint.classList.toggle('disabled', (session && !session.capabilities.supportsDataBreakpoints) || !this.debugService.getModel().areBreakpointsActivated());
		if (session && !session.capabilities.supportsDataBreakpoints) {
			data.breakpoint.title = localize('dataBreakpointsNotSupported', "Data breakpoints are not supported by this debug type");
		}
	}

	disposeTemplate(templateData: IBaseBreakpointWithIconTemplateData): void {
		dispose(templateData.toDispose);
	}
}

class FunctionBreakpointInputRenderer implements IListRenderer<IFunctionBreakpoint, IFunctionBreakpointInputTemplateData> {

	constructor(
		private debugService: IDebugService,
		private contextViewService: IContextViewService,
		private themeService: IThemeService,
		private labelService: ILabelService
	) {
		// noop
	}

	static readonly ID = 'functionbreakpointinput';

	get templateId() {
		return FunctionBreakpointInputRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IFunctionBreakpointInputTemplateData {
		const template: IFunctionBreakpointInputTemplateData = Object.create(null);

		const breakpoint = dom.append(container, $('.breakpoint'));
		template.icon = $('.icon');
		template.checkbox = createCheckbox();

		dom.append(breakpoint, template.icon);
		dom.append(breakpoint, template.checkbox);
		const inputBoxContainer = dom.append(breakpoint, $('.inputBoxContainer'));
		const inputBox = new InputBox(inputBoxContainer, this.contextViewService, {
			placeholder: localize('functionBreakpointPlaceholder', "Function to break on"),
			ariaLabel: localize('functionBreakPointInputAriaLabel', "Type function breakpoint")
		});
		const styler = attachInputBoxStyler(inputBox, this.themeService);
		const toDispose: IDisposable[] = [inputBox, styler];

		const wrapUp = (renamed: boolean) => {
			if (!template.reactedOnEvent) {
				template.reactedOnEvent = true;
				this.debugService.getViewModel().setSelectedBreakpoint(undefined);
				if (inputBox.value && (renamed || template.breakpoint.name)) {
					this.debugService.renameFunctionBreakpoint(template.breakpoint.getId(), renamed ? inputBox.value : template.breakpoint.name);
				} else {
					this.debugService.removeFunctionBreakpoints(template.breakpoint.getId());
				}
			}
		};

		toDispose.push(dom.addStandardDisposableListener(inputBox.inputElement, 'keydown', (e: IKeyboardEvent) => {
			const isEscape = e.equals(KeyCode.Escape);
			const isEnter = e.equals(KeyCode.Enter);
			if (isEscape || isEnter) {
				e.preventDefault();
				e.stopPropagation();
				wrapUp(isEnter);
			}
		}));
		toDispose.push(dom.addDisposableListener(inputBox.inputElement, 'blur', () => {
			// Need to react with a timeout on the blur event due to possible concurent splices #56443
			setTimeout(() => {
				if (!template.breakpoint.name) {
					wrapUp(true);
				}
			});
		}));

		template.inputBox = inputBox;
		template.toDispose = toDispose;
		return template;
	}

	renderElement(functionBreakpoint: FunctionBreakpoint, _index: number, data: IFunctionBreakpointInputTemplateData): void {
		data.breakpoint = functionBreakpoint;
		data.reactedOnEvent = false;
		const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), functionBreakpoint, this.labelService);

		data.icon.className = ThemeIcon.asClassName(icon);
		data.icon.title = message ? message : '';
		data.checkbox.checked = functionBreakpoint.enabled;
		data.checkbox.disabled = true;
		data.inputBox.value = functionBreakpoint.name || '';
		setTimeout(() => {
			data.inputBox.focus();
			data.inputBox.select();
		}, 0);
	}

	disposeTemplate(templateData: IFunctionBreakpointInputTemplateData): void {
		dispose(templateData.toDispose);
	}
}

class ExceptionBreakpointInputRenderer implements IListRenderer<IExceptionBreakpoint, IExceptionBreakpointInputTemplateData> {

	constructor(
		private debugService: IDebugService,
		private contextViewService: IContextViewService,
		private themeService: IThemeService
	) {
		// noop
	}

	static readonly ID = 'exceptionbreakpointinput';

	get templateId() {
		return ExceptionBreakpointInputRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IExceptionBreakpointInputTemplateData {
		const template: IExceptionBreakpointInputTemplateData = Object.create(null);

		const breakpoint = dom.append(container, $('.breakpoint'));
		breakpoint.classList.add('exception');
		template.checkbox = createCheckbox();

		dom.append(breakpoint, template.checkbox);
		const inputBoxContainer = dom.append(breakpoint, $('.inputBoxContainer'));
		const inputBox = new InputBox(inputBoxContainer, this.contextViewService, {
			placeholder: localize('exceptionBreakpointPlaceholder', "Break when expression evaluates to true"),
			ariaLabel: localize('exceptionBreakpointAriaLabel', "Type exception breakpoint condition")
		});
		const styler = attachInputBoxStyler(inputBox, this.themeService);
		const toDispose: IDisposable[] = [inputBox, styler];

		const wrapUp = (success: boolean) => {
			if (!template.reactedOnEvent) {
				template.reactedOnEvent = true;
				this.debugService.getViewModel().setSelectedBreakpoint(undefined);
				let newCondition = template.breakpoint.condition;
				if (success) {
					newCondition = inputBox.value !== '' ? inputBox.value : undefined;
				}
				this.debugService.setExceptionBreakpointCondition(template.breakpoint, newCondition);
			}
		};

		toDispose.push(dom.addStandardDisposableListener(inputBox.inputElement, 'keydown', (e: IKeyboardEvent) => {
			const isEscape = e.equals(KeyCode.Escape);
			const isEnter = e.equals(KeyCode.Enter);
			if (isEscape || isEnter) {
				e.preventDefault();
				e.stopPropagation();
				wrapUp(isEnter);
			}
		}));
		toDispose.push(dom.addDisposableListener(inputBox.inputElement, 'blur', () => {
			// Need to react with a timeout on the blur event due to possible concurent splices #56443
			setTimeout(() => {
				wrapUp(true);
			});
		}));

		template.inputBox = inputBox;
		template.toDispose = toDispose;
		return template;
	}

	renderElement(exceptionBreakpoint: ExceptionBreakpoint, _index: number, data: IExceptionBreakpointInputTemplateData): void {
		data.breakpoint = exceptionBreakpoint;
		data.reactedOnEvent = false;
		data.checkbox.checked = exceptionBreakpoint.enabled;
		data.checkbox.disabled = true;
		data.inputBox.value = exceptionBreakpoint.condition || '';
		setTimeout(() => {
			data.inputBox.focus();
			data.inputBox.select();
		}, 0);
	}

	disposeTemplate(templateData: IExceptionBreakpointInputTemplateData): void {
		dispose(templateData.toDispose);
	}
}

class BreakpointsAccessibilityProvider implements IListAccessibilityProvider<BreakpointItem> {

	constructor(
		private readonly debugService: IDebugService,
		private readonly labelService: ILabelService
	) { }

	getWidgetAriaLabel(): string {
		return localize('breakpoints', "Breakpoints");
	}

	getRole() {
		return 'checkbox';
	}

	isChecked(breakpoint: IEnablement) {
		return breakpoint.enabled;
	}

	getAriaLabel(element: BreakpointItem): string | null {
		if (element instanceof ExceptionBreakpoint) {
			return element.toString();
		}

		const { message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), element as IBreakpoint | IDataBreakpoint | IFunctionBreakpoint, this.labelService);
		const toString = element.toString();

		return message ? `${toString}, ${message}` : toString;
	}
}

export function openBreakpointSource(breakpoint: IBreakpoint, sideBySide: boolean, preserveFocus: boolean, pinned: boolean, debugService: IDebugService, editorService: IEditorService): Promise<IEditorPane | undefined> {
	if (breakpoint.uri.scheme === DEBUG_SCHEME && debugService.state === State.Inactive) {
		return Promise.resolve(undefined);
	}

	const selection = breakpoint.endLineNumber ? {
		startLineNumber: breakpoint.lineNumber,
		endLineNumber: breakpoint.endLineNumber,
		startColumn: breakpoint.column || 1,
		endColumn: breakpoint.endColumn || Constants.MAX_SAFE_SMALL_INTEGER
	} : {
			startLineNumber: breakpoint.lineNumber,
			startColumn: breakpoint.column || 1,
			endLineNumber: breakpoint.lineNumber,
			endColumn: breakpoint.column || Constants.MAX_SAFE_SMALL_INTEGER
		};

	return editorService.openEditor({
		resource: breakpoint.uri,
		options: {
			preserveFocus,
			selection,
			revealIfOpened: true,
			selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport,
			pinned
		}
	}, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
}

export function getBreakpointMessageAndIcon(state: State, breakpointsActivated: boolean, breakpoint: IBreakpoint | IFunctionBreakpoint | IDataBreakpoint, labelService?: ILabelService): { message?: string, icon: ThemeIcon } {
	const debugActive = state === State.Running || state === State.Stopped;

	const breakpointIcon = breakpoint instanceof DataBreakpoint ? icons.dataBreakpoint : breakpoint instanceof FunctionBreakpoint ? icons.functionBreakpoint : breakpoint.logMessage ? icons.logBreakpoint : icons.breakpoint;

	if (!breakpoint.enabled || !breakpointsActivated) {
		return {
			icon: breakpointIcon.disabled,
			message: breakpoint.logMessage ? localize('disabledLogpoint', "Disabled Logpoint") : localize('disabledBreakpoint', "Disabled Breakpoint"),
		};
	}

	const appendMessage = (text: string): string => {
		return ('message' in breakpoint && breakpoint.message) ? text.concat(', ' + breakpoint.message) : text;
	};
	if (debugActive && !breakpoint.verified) {
		return {
			icon: breakpointIcon.unverified,
			message: ('message' in breakpoint && breakpoint.message) ? breakpoint.message : (breakpoint.logMessage ? localize('unverifiedLogpoint', "Unverified Logpoint") : localize('unverifiedBreakopint', "Unverified Breakpoint")),
		};
	}

	if (breakpoint instanceof FunctionBreakpoint) {
		if (!breakpoint.supported) {
			return {
				icon: breakpointIcon.unverified,
				message: localize('functionBreakpointUnsupported', "Function breakpoints not supported by this debug type"),
			};
		}

		return {
			icon: breakpointIcon.regular,
			message: breakpoint.message || localize('functionBreakpoint', "Function Breakpoint")
		};
	}

	if (breakpoint instanceof DataBreakpoint) {
		if (!breakpoint.supported) {
			return {
				icon: breakpointIcon.unverified,
				message: localize('dataBreakpointUnsupported', "Data breakpoints not supported by this debug type"),
			};
		}

		return {
			icon: breakpointIcon.regular,
			message: breakpoint.message || localize('dataBreakpoint', "Data Breakpoint")
		};
	}

	if (breakpoint.logMessage || breakpoint.condition || breakpoint.hitCondition) {
		const messages: string[] = [];

		if (!breakpoint.supported) {
			return {
				icon: icons.debugBreakpointUnsupported,
				message: localize('breakpointUnsupported', "Breakpoints of this type are not supported by the debugger"),
			};
		}

		if (breakpoint.logMessage) {
			messages.push(localize('logMessage', "Log Message: {0}", breakpoint.logMessage));
		}
		if (breakpoint.condition) {
			messages.push(localize('expression', "Expression condition: {0}", breakpoint.condition));
		}
		if (breakpoint.hitCondition) {
			messages.push(localize('hitCount', "Hit Count: {0}", breakpoint.hitCondition));
		}

		return {
			icon: breakpoint.logMessage ? icons.logBreakpoint.regular : icons.conditionalBreakpoint.regular,
			message: appendMessage(messages.join('\n'))
		};
	}

	const message = ('message' in breakpoint && breakpoint.message) ? breakpoint.message : breakpoint instanceof Breakpoint && labelService ? labelService.getUriLabel(breakpoint.uri) : localize('breakpoint', "Breakpoint");
	return {
		icon: breakpointIcon.regular,
		message
	};
}

export const FUNCTION_BREAKPOINT_COMMAND_ID = 'workbench.debug.viewlet.action.addFunctionBreakpointAction';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: FUNCTION_BREAKPOINT_COMMAND_ID,
			title: localize('addFunctionBreakpoint', "Add Function Breakpoint"),
			f1: true,
			icon: icons.watchExpressionsAddFuncBreakpoint,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 10,
				when: ContextKeyEqualsExpr.create('view', BREAKPOINTS_VIEW_ID)
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const debugService = accessor.get(IDebugService);
		debugService.addFunctionBreakpoint();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.debug.viewlet.action.toggleBreakpointsActivatedAction',
			title: localize('activateBreakpoints', "Toggle Activate Breakpoints"),
			f1: true,
			icon: icons.breakpointsActivate,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 20,
				when: ContextKeyEqualsExpr.create('view', BREAKPOINTS_VIEW_ID)
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const debugService = accessor.get(IDebugService);
		debugService.setBreakpointsActivated(!debugService.getModel().areBreakpointsActivated());
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.debug.viewlet.action.removeBreakpoint',
			title: localize('removeBreakpoint', "Remove Breakpoint"),
			menu: [{
				id: MenuId.DebugBreakpointsContext,
				group: '3_modification',
				order: 10,
				when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo('exceptionBreakpoint')
			}]
		});
	}

	async run(accessor: ServicesAccessor, breakpoint: IBaseBreakpoint): Promise<void> {
		const debugService = accessor.get(IDebugService);
		if (breakpoint instanceof Breakpoint) {
			await debugService.removeBreakpoints(breakpoint.getId());
		} else if (breakpoint instanceof FunctionBreakpoint) {
			await debugService.removeFunctionBreakpoints(breakpoint.getId());
		} else if (breakpoint instanceof DataBreakpoint) {
			await debugService.removeDataBreakpoints(breakpoint.getId());
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.debug.viewlet.action.removeAllBreakpoints',
			title: {
				original: 'Remove All Breakpoints',
				value: localize('removeAllBreakpoints', "Remove All Breakpoints"),
				mnemonicedTitle: localize({ key: 'miRemoveAllBreakpoints', comment: ['&& denotes a mnemonic'] }, "Remove &&All Breakpoints")
			},
			f1: true,
			icon: icons.breakpointsRemoveAll,
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 30,
				when: ContextKeyEqualsExpr.create('view', BREAKPOINTS_VIEW_ID)
			}, {
				id: MenuId.DebugBreakpointsContext,
				group: '3_modification',
				order: 20,
				when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo('exceptionBreakpoint'))
			}, {
				id: MenuId.MenubarDebugMenu,
				group: '5_breakpoints',
				order: 3,
				when: CONTEXT_DEBUGGERS_AVAILABLE
			}]
		});
	}

	run(accessor: ServicesAccessor): void {
		const debugService = accessor.get(IDebugService);
		debugService.removeBreakpoints();
		debugService.removeFunctionBreakpoints();
		debugService.removeDataBreakpoints();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.debug.viewlet.action.enableAllBreakpoints',
			title: {
				original: '',
				value: localize('enableAllBreakpoints', "Enable All Breakpoints"),
				mnemonicedTitle: localize({ key: 'miEnableAllBreakpoints', comment: ['&& denotes a mnemonic'] }, "&&Enable All Breakpoints"),
			},
			f1: true,
			precondition: CONTEXT_DEBUGGERS_AVAILABLE,
			menu: [{
				id: MenuId.DebugBreakpointsContext,
				group: 'z_commands',
				order: 10,
				when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo('exceptionBreakpoint'))
			}, {
				id: MenuId.MenubarDebugMenu,
				group: '5_breakpoints',
				order: 1,
				when: CONTEXT_DEBUGGERS_AVAILABLE
			}]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const debugService = accessor.get(IDebugService);
		await debugService.enableOrDisableBreakpoints(true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.debug.viewlet.action.disableAllBreakpoints',
			title: {
				original: 'Disable All Breakpoints',
				value: localize('disableAllBreakpoints', "Disable All Breakpoints"),
				mnemonicedTitle: localize({ key: 'miDisableAllBreakpoints', comment: ['&& denotes a mnemonic'] }, "Disable A&&ll Breakpoints")
			},
			f1: true,
			precondition: CONTEXT_DEBUGGERS_AVAILABLE,
			menu: [{
				id: MenuId.DebugBreakpointsContext,
				group: 'z_commands',
				order: 20,
				when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo('exceptionBreakpoint'))
			}, {
				id: MenuId.MenubarDebugMenu,
				group: '5_breakpoints',
				order: 2,

				when: CONTEXT_DEBUGGERS_AVAILABLE
			}]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const debugService = accessor.get(IDebugService);
		await debugService.enableOrDisableBreakpoints(false);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.debug.viewlet.action.reapplyBreakpointsAction',
			title: localize('reapplyAllBreakpoints', "Reapply All Breakpoints"),
			f1: true,
			precondition: CONTEXT_IN_DEBUG_MODE,
			menu: [{
				id: MenuId.DebugBreakpointsContext,
				group: 'z_commands',
				order: 30,
				when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo('exceptionBreakpoint'))
			}]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const debugService = accessor.get(IDebugService);
		await debugService.setBreakpointsActivated(true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.debug.editExceptionBreakpointCondition',
			title: localize('editCondition', "Edit Condition"),
			menu: [{
				id: MenuId.DebugBreakpointsContext,
				group: 'navigation',
				order: 10,
				when: CONTEXT_EXCEPTION_BREAKPOINT_SUPPORTS_CONDITION
			}]
		});
	}

	async run(accessor: ServicesAccessor, breakpoint: ExceptionBreakpoint): Promise<void> {
		const debugService = accessor.get(IDebugService);
		debugService.getViewModel().setSelectedBreakpoint(breakpoint);
	}
});


registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'debug.editBreakpoint',
			title: localize('editBreakpoint', "Edit Breakpoint..."),
			menu: [{
				id: MenuId.DebugBreakpointsContext,
				group: 'navigation',
				order: 10,
				when: ContextKeyExpr.or(CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo('breakpoint'), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo('functionBreakpoint'))
			}]
		});
	}

	async run(accessor: ServicesAccessor, breakpoint: ExceptionBreakpoint): Promise<void> {
		const debugService = accessor.get(IDebugService);
		const editorService = accessor.get(IEditorService);
		if (breakpoint instanceof Breakpoint) {
			const editor = await openBreakpointSource(breakpoint, false, false, true, debugService, editorService);
			if (editor) {
				const codeEditor = editor.getControl();
				if (isCodeEditor(codeEditor)) {
					codeEditor.getContribution<IBreakpointEditorContribution>(BREAKPOINT_EDITOR_CONTRIBUTION_ID).showBreakpointWidget(breakpoint.lineNumber, breakpoint.column);
				}
			}
		} else {
			debugService.getViewModel().setSelectedBreakpoint(breakpoint);
		}
	}
});
