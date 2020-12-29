/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./gettingStarted';
import 'vs/workbench/contrib/welcome/gettingStarted/browser/vs_code_editor_getting_started';
import { localize } from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WalkThroughInput } from 'vs/workbench/contrib/welcome/walkThrough/browser/walkThroughInput';
import { FileAccess, Schemas } from 'vs/base/common/network';
import { IEditorInputFactory } from 'vs/workbench/common/editor';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { assertIsDefined } from 'vs/base/common/types';
import { $, addDisposableListener } from 'vs/base/browser/dom';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IProductService } from 'vs/platform/product/common/productService';
import { IGettingStartedCategoryWithProgress, IGettingStartedService } from 'vs/workbench/services/gettingStarted/common/gettingStartedService';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { buttonBackground as welcomeButtonBackground, buttonHoverBackground as welcomeButtonHoverBackground, welcomePageBackground } from 'vs/workbench/contrib/welcome/page/browser/welcomePageColors';
import { activeContrastBorder, buttonBackground, buttonForeground, buttonHoverBackground, buttonSecondaryBackground, contrastBorder, descriptionForeground, focusBorder, foreground, textLinkActiveForeground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';
import { getExtraColor } from 'vs/workbench/contrib/welcome/walkThrough/common/walkThroughUtils';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';

export const gettingStartedInputTypeId = 'workbench.editors.gettingStartedInput';
const telemetryFrom = 'gettingStartedPage';

export class GettingStartedInput extends WalkThroughInput {
	static readonly ID = gettingStartedInputTypeId;

	selectedCategory: string | undefined;
	selectedTask: string | undefined;
}

export class GettingStartedPage extends Disposable {
	readonly editorInput: GettingStartedInput;
	private inProgressScroll = Promise.resolve();

	private dispatchListeners = new DisposableStore();

	private gettingStartedCategories: IGettingStartedCategoryWithProgress[];
	private currentCategory: IGettingStartedCategoryWithProgress | undefined;

	private categoriesScrollbar: DomScrollableElement | undefined;
	private detailsScrollbar: DomScrollableElement | undefined;
	private detailImageScrollbar: DomScrollableElement | undefined;

	constructor(
		initialState: { selectedCategory?: string, selectedTask?: string },
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IProductService private readonly productService: IProductService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IGettingStartedService private readonly gettingStartedService: IGettingStartedService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		const resource = FileAccess.asBrowserUri('./vs_code_editor_getting_started.md', require)
			.with({
				scheme: Schemas.walkThrough,
				query: JSON.stringify({ moduleId: 'vs/workbench/contrib/welcome/gettingStarted/browser/vs_code_editor_getting_started' })
			});


		this.editorInput = this.instantiationService.createInstance(GettingStartedInput, {
			typeId: gettingStartedInputTypeId,
			name: localize('editorGettingStarted.title', "Getting Started"),
			resource,
			telemetryFrom,
			onReady: (container: HTMLElement) => this.onReady(container),
			layout: () => this.layout(),
		});

		this.editorInput.selectedCategory = initialState.selectedCategory;
		this.editorInput.selectedTask = initialState.selectedTask;

		this.gettingStartedCategories = this.gettingStartedService.getCategories();
		this._register(this.dispatchListeners);
		this._register(this.gettingStartedService.onDidAddTask(task => console.log('added new task', task, 'that isnt being rendered yet')));
		this._register(this.gettingStartedService.onDidAddCategory(category => console.log('added new category', category, 'that isnt being rendered yet')));
		this._register(this.gettingStartedService.onDidProgressTask(task => {
			const category = this.gettingStartedCategories.find(category => category.id === task.category);
			if (!category) { throw Error('Could not find category with ID: ' + task.category); }
			if (category.content.type !== 'items') { throw Error('internaal error: progressing task in a non-items category'); }
			const ourTask = category.content.items.find(_task => _task.id === task.id);
			if (!ourTask) {
				throw Error('Could not find task with ID: ' + task.id);
			}
			ourTask.done = task.done;
			if (category.id === this.currentCategory?.id) {
				const badgeelement = assertIsDefined(document.getElementById('done-task-' + task.id));
				if (task.done) {
					badgeelement.classList.remove('codicon-circle-large-outline');
					badgeelement.classList.add('codicon-pass-filled', 'complete');
				}
				else {
					badgeelement.classList.add('codicon-circle-large-outline');
					badgeelement.classList.remove('codicon-pass-filled', 'complete');
				}
			}
			this.updateCategoryProgress();
		}));
	}

	public openEditor(options: IEditorOptions = { pinned: true }) {
		return this.editorService.openEditor(this.editorInput, options);
	}

	private registerDispatchListeners(container: HTMLElement) {
		this.dispatchListeners.clear();

		container.querySelectorAll('[x-dispatch]').forEach(element => {
			const [command, argument] = (element.getAttribute('x-dispatch') ?? '').split(':');
			if (command) {
				this.dispatchListeners.add(addDisposableListener(element, 'click', (e) => {

					type GettingStartedActionClassification = {
						command: { classification: 'PublicNonPersonalData', purpose: 'FeatureInsight' };
						argument: { classification: 'PublicNonPersonalData', purpose: 'FeatureInsight' };
					};
					type GettingStartedActionEvent = {
						command: string;
						argument: string | undefined;
					};
					this.telemetryService.publicLog2<GettingStartedActionEvent, GettingStartedActionClassification>('gettingStarted.ActionExecuted', { command, argument });

					switch (command) {
						case 'scrollPrev': {
							this.scrollPrev(container);
							break;
						}
						case 'skip': {
							this.commandService.executeCommand('workbench.action.closeActiveEditor');
							break;
						}
						case 'selectCategory': {
							const selectedCategory = this.gettingStartedCategories.find(category => category.id === argument);
							if (!selectedCategory) { throw Error('Could not find category with ID ' + argument); }
							if (selectedCategory.content.type === 'command') {
								this.commandService.executeCommand(selectedCategory.content.command);
							} else {
								this.scrollToCategory(container, argument);
							}
							break;
						}
						case 'selectTask': {
							this.selectTask(argument);
							e.stopPropagation();
							break;
						}
						case 'runTaskAction': {
							if (!this.currentCategory || this.currentCategory.content.type !== 'items') {
								throw Error('cannot run task action for category of non items type' + this.currentCategory?.id);
							}
							const taskToRun = assertIsDefined(this.currentCategory?.content.items.find(task => task.id === argument));
							const commandToRun = assertIsDefined(taskToRun.button?.command);
							this.commandService.executeCommand(commandToRun);
							break;
						}
						default: {
							console.error('Dispatch to', command, argument, 'not defined');
							break;
						}
					}
				}));
			}
		});
	}

	private selectTask(id: string | undefined) {
		const mediaElement = assertIsDefined(document.getElementById('getting-started-media'));
		if (id) {
			const taskElement = assertIsDefined(document.getElementById('getting-started-task-' + id));
			if (!this.currentCategory || this.currentCategory.content.type !== 'items') {
				throw Error('cannot expand task for category of non items type' + this.currentCategory?.id);
			}
			this.editorInput.selectedTask = id;
			const taskToExpand = assertIsDefined(this.currentCategory.content.items.find(task => task.id === id));

			mediaElement.setAttribute('src', taskToExpand.media.path.toString());
			mediaElement.setAttribute('alt', taskToExpand.media.altText);
			taskElement.parentElement?.querySelectorAll('.expanded').forEach(node => node.classList.remove('expanded'));
			taskElement.classList.add('expanded');
		} else {
			mediaElement.setAttribute('src', '');
			mediaElement.setAttribute('alt', '');
		}
		this.detailsScrollbar?.scanDomNode();
		this.detailImageScrollbar?.scanDomNode();
	}

	private onReady(container: HTMLElement) {
		const categoryElements = this.gettingStartedCategories.map(
			category => {
				const categoryDescriptionElement =
					category.content.type === 'items' ?
						$('.category-description-container', {},
							$('h3.category-title', {}, category.title),
							$('.category-description.description', {}, category.description),
							$('.category-progress', { 'x-data-category-id': category.id, }, $('.message'), $('progress'))) :
						$('.category-description-container', {},
							$('h3.category-title', {}, category.title),
							$('.category-description.description', {}, category.description));

				return $('button.getting-started-category',
					{ 'x-dispatch': 'selectCategory:' + category.id },
					$('.codicon.codicon-' + category.codicon, {}), categoryDescriptionElement);
			});

		const categoriesSlide = assertIsDefined(document.getElementById('gettingStartedSlideCategory'));
		const tasksSlide = assertIsDefined(document.getElementById('gettingStartedSlideDetails'));

		const tasksContent = assertIsDefined(document.getElementById('gettingStartedDetailsContent'));
		tasksContent.remove();
		if (this.detailImageScrollbar) { this.detailImageScrollbar.dispose(); }
		this.detailImageScrollbar = this._register(new DomScrollableElement(tasksContent, { className: 'full-height-scrollable' }));
		tasksSlide.appendChild(this.detailImageScrollbar.getDomNode());
		this.detailImageScrollbar.scanDomNode();

		const rightColumn = assertIsDefined(container.querySelector('#getting-started-detail-right'));
		rightColumn.appendChild($('img#getting-started-media'));

		const categoryScrollContainer = $('#getting-started-categories-scrolling-container');
		const categoriesContainer = $('#getting-started-categories-container');
		categoryElements.forEach(element => {
			categoriesContainer.appendChild(element);
		});

		categoryScrollContainer.appendChild(categoriesContainer);
		categoryScrollContainer.appendChild($('.footer', {}, $('a.skip', { 'x-dispatch': 'skip' }, localize('gettingStarted.skip', "Skip"))));

		if (this.categoriesScrollbar) { this.categoriesScrollbar.dispose(); }
		this.categoriesScrollbar = this._register(new DomScrollableElement(categoryScrollContainer, {}));
		categoriesSlide.appendChild(this.categoriesScrollbar.getDomNode());
		categoriesSlide.appendChild($('.gap'));
		this.categoriesScrollbar.scanDomNode();

		this.updateCategoryProgress();

		assertIsDefined(document.getElementById('product-name')).textContent = this.productService.nameLong;
		this.registerDispatchListeners(container);


		if (this.editorInput.selectedCategory) {
			this.currentCategory = this.gettingStartedCategories.find(category => category.id === this.editorInput.selectedCategory);
			if (!this.currentCategory) {
				throw Error('Could not restore to category ' + this.editorInput.selectedCategory + ' as it was not found');
			}
			this.buildCategorySlide(container, this.editorInput.selectedCategory, this.editorInput.selectedTask);
			categoriesSlide.classList.add('prev');
		} else {
			tasksSlide.classList.add('next');
		}
	}

	private layout() {
		this.categoriesScrollbar?.scanDomNode();
		this.detailsScrollbar?.scanDomNode();
		this.detailImageScrollbar?.scanDomNode();
	}

	private updateCategoryProgress() {
		document.querySelectorAll('.category-progress').forEach(element => {
			const categoryID = element.getAttribute('x-data-category-id');
			const category = this.gettingStartedCategories.find(category => category.id === categoryID);
			if (!category) { throw Error('Could not find category with ID ' + categoryID); }
			if (category.content.type !== 'items') { throw Error('Category with ID ' + categoryID + ' is not of items type'); }
			const numDone = category.content.items.filter(task => task.done).length;
			const numTotal = category.content.items.length;

			const message = assertIsDefined(element.firstChild);
			const bar = assertIsDefined(element.lastChild) as HTMLProgressElement;
			bar.value = numDone;
			bar.max = numTotal;
			if (numTotal === numDone) {
				message.textContent = `All items complete!`;
			}
			else {
				message.textContent = `${numDone} of ${numTotal} items complete`;
			}
		});
	}

	private async scrollToCategory(container: HTMLElement, categoryID: string) {
		this.inProgressScroll = this.inProgressScroll.then(async () => {
			this.clearDetialView();
			this.editorInput.selectedCategory = categoryID;
			this.currentCategory = this.gettingStartedCategories.find(category => category.id === categoryID);
			const slides = [...container.querySelectorAll('.gettingStartedSlide').values()];
			const currentSlide = slides.findIndex(element => !element.classList.contains('prev') && !element.classList.contains('next'));
			if (currentSlide < slides.length - 1) {
				this.buildCategorySlide(container, categoryID);
				slides[currentSlide].classList.add('prev');
				slides[currentSlide + 1].classList.remove('next');
			}
		});
	}

	private buildCategorySlide(container: HTMLElement, categoryID: string, selectedItem?: string) {
		const category = this.gettingStartedCategories.find(category => category.id === categoryID);
		if (!category) { throw Error('could not find category with ID ' + categoryID); }
		if (category.content.type !== 'items') { throw Error('category with ID ' + categoryID + ' is not of items type'); }

		const leftColumn = assertIsDefined(document.getElementById('getting-started-detail-left'));
		const detailTitle = assertIsDefined(document.getElementById('getting-started-detail-title'));
		detailTitle.appendChild(
			$('.getting-started-category',
				{},
				$('.codicon.codicon-' + category.codicon, {}),
				$('.category-description-container', {},
					$('h2.category-title', {}, category.title),
					$('.category-description.description', {}, category.description))));

		const categoryElements = category.content.items.map(
			(task, i, arr) => $('button.getting-started-task',
				{ 'x-dispatch': 'selectTask:' + task.id, id: 'getting-started-task-' + task.id },
				$('.codicon' + (task.done ? '.complete.codicon-pass-filled' : '.codicon-circle-large-outline'), { id: 'done-task-' + task.id }),
				$('.task-description-container', {},
					$('h3.task-title', {}, task.title),
					$('.task-description.description', {}, task.description),
					$('.actions', {},
						...(
							task.button
								? [$('button.emphasis.getting-started-task-action', { 'x-dispatch': 'runTaskAction:' + task.id },
									task.button.title + this.getKeybindingLabel(task.button.command)
								)]
								: []),
						...(
							arr[i + 1]
								? [
									$('a.task-next',
										{ 'x-dispatch': 'selectTask:' + arr[i + 1].id }, localize('next', "Next")),
								] : []
						))
				)));

		const detailContainer = $('#getting-started-detail-container');
		if (this.detailsScrollbar) { this.detailsScrollbar.getDomNode().remove(); this.detailsScrollbar.dispose(); }
		this.detailsScrollbar = this._register(new DomScrollableElement(detailContainer, { className: 'full-height-scrollable' }));
		categoryElements.forEach(element => detailContainer.appendChild(element));
		leftColumn.appendChild(this.detailsScrollbar.getDomNode());

		const toExpand = category.content.items.find(item => !item.done) ?? category.content.items[0];
		this.selectTask(selectedItem ?? toExpand.id);
		this.detailsScrollbar.scanDomNode();
		this.registerDispatchListeners(container);
	}

	private clearDetialView() {
		const detailContainer = (document.getElementById('getting-started-detail-container'));
		detailContainer?.remove();
		const detailTitle = assertIsDefined(document.getElementById('getting-started-detail-title'));
		while (detailTitle.firstChild) { detailTitle.removeChild(detailTitle.firstChild); }
	}

	private getKeybindingLabel(command: string) {
		const binding = this.keybindingService.lookupKeybinding(command);
		if (!binding) { return ''; }
		else { return ` (${binding.getLabel()})`; }
	}

	private async scrollPrev(container: HTMLElement) {
		this.inProgressScroll = this.inProgressScroll.then(async () => {
			this.currentCategory = undefined;
			this.editorInput.selectedCategory = undefined;
			this.editorInput.selectedTask = undefined;
			this.selectTask(undefined);
			const slides = [...container.querySelectorAll('.gettingStartedSlide').values()];
			const currentSlide = slides.findIndex(element =>
				!element.classList.contains('prev') && !element.classList.contains('next'));
			if (currentSlide > 0) {
				slides[currentSlide].classList.add('next');
				assertIsDefined(slides[currentSlide - 1]).classList.remove('prev');
			}
		});
	}
}

export class GettingStartedInputFactory implements IEditorInputFactory {
	public canSerialize(editorInput: GettingStartedInput): boolean {
		return true;
	}

	public serialize(editorInput: GettingStartedInput): string {
		return JSON.stringify({ selectedCategory: editorInput.selectedCategory, selectedTask: editorInput.selectedTask });
	}

	public deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): GettingStartedInput {
		try {
			const { selectedCategory, selectedTask } = JSON.parse(serializedEditorInput);
			return instantiationService.createInstance(GettingStartedPage, { selectedCategory, selectedTask }).editorInput;
		} catch { }
		return instantiationService.createInstance(GettingStartedPage, {}).editorInput;
	}
}

registerThemingParticipant((theme, collector) => {
	const backgroundColor = theme.getColor(welcomePageBackground);
	if (backgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer { background-color: ${backgroundColor}; }`);
	}
	const foregroundColor = theme.getColor(foreground);
	if (foregroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer { color: ${foregroundColor}; }`);
	}
	const descriptionColor = theme.getColor(descriptionForeground);
	if (descriptionColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer .description { color: ${descriptionColor}; }`);
	}
	const buttonColor = getExtraColor(theme, welcomeButtonBackground, { dark: 'rgba(0, 0, 0, .2)', extra_dark: 'rgba(200, 235, 255, .042)', light: 'rgba(0,0,0,.04)', hc: 'black' });
	if (buttonColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button { background: ${buttonColor}; }`);
	}

	const buttonHoverColor = getExtraColor(theme, welcomeButtonHoverBackground, { dark: 'rgba(200, 235, 255, .072)', extra_dark: 'rgba(200, 235, 255, .072)', light: 'rgba(0,0,0,.10)', hc: null });
	if (buttonHoverColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button:hover { background: ${buttonHoverColor}; }`);
	}
	if (buttonColor && buttonHoverColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button.expanded:hover { background: ${buttonColor}; }`);
	}

	const emphasisButtonForeground = theme.getColor(buttonForeground);
	if (emphasisButtonForeground) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button.emphasis { color: ${emphasisButtonForeground}; }`);
	}

	const emphasisButtonBackground = theme.getColor(buttonBackground);
	if (emphasisButtonBackground) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button.emphasis { background: ${emphasisButtonBackground}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer .getting-started-category .codicon { color: ${emphasisButtonBackground} }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer .gettingStartedSlide.detail .getting-started-task .codicon.complete { color: ${emphasisButtonBackground} } `);
	}

	const pendingItemColor = theme.getColor(buttonSecondaryBackground);
	if (pendingItemColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer .gettingStartedSlide.detail .getting-started-task .codicon { color: ${pendingItemColor} } `);
	}

	const emphasisButtonHoverBackground = theme.getColor(buttonHoverBackground);
	if (emphasisButtonHoverBackground) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button.emphasis:hover { background: ${emphasisButtonHoverBackground}; }`);
	}

	const link = theme.getColor(textLinkForeground);
	if (link) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer a { color: ${link}; }`);
	}
	const activeLink = theme.getColor(textLinkActiveForeground);
	if (activeLink) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer a:hover,
			.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer a:active { color: ${activeLink}; }`);
	}
	const focusColor = theme.getColor(focusBorder);
	if (focusColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer a:focus { outline-color: ${focusColor}; }`);
	}
	const border = theme.getColor(contrastBorder);
	if (border) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button { border-color: ${border}; border: 1px solid; }`);
	}
	const activeBorder = theme.getColor(activeContrastBorder);
	if (activeBorder) {
		collector.addRule(`.monaco-workbench .part.editor > .content .walkThroughContent .gettingStartedContainer button:hover { outline-color: ${activeBorder}; }`);
	}
});
