export const A2UI_VERSION: string;
export const A2UI_BASIC_CATALOG: string;
export const A2UI_WIDGET_TYPE: string;
export function a2uiSurfaceId(uuid: string): string;

export type A2uiComponentNode = { id: string; component: string; [key: string]: any };

export type A2uiLayoutOptions = { justify?: string; align?: string };
export type A2uiListOptions = A2uiLayoutOptions & { direction?: 'vertical' | 'horizontal'; listStyle?: 'ordered' | 'unordered' | 'none' };
export type A2uiAction = { call: string; args?: Record<string, any> };

export function a2uiColumn(id: string, children: string[], options?: A2uiLayoutOptions): A2uiComponentNode;
export function a2uiRow(id: string, children: string[], options?: A2uiLayoutOptions): A2uiComponentNode;
export function a2uiList(id: string, children: string[], options?: A2uiListOptions): A2uiComponentNode;
export function a2uiCard(id: string, child: string): A2uiComponentNode;
export function a2uiText(id: string, value: string, variant?: string): A2uiComponentNode;
export function a2uiIcon(id: string, name: string): A2uiComponentNode;
export function a2uiDivider(id: string, options?: { axis?: 'horizontal' | 'vertical' }): A2uiComponentNode;
export function a2uiImage(
    id: string,
    url: string,
    options?: { variant?: string; fit?: string; description?: string }
): A2uiComponentNode;
export function a2uiVideo(id: string, url: string): A2uiComponentNode;
export function a2uiAudio(id: string, url: string, options?: { description?: string }): A2uiComponentNode;
export function a2uiTabs(id: string, tabs: { title: string; child: string }[]): A2uiComponentNode;
export function a2uiModal(id: string, input: { trigger: string; content: string }): A2uiComponentNode;

export function a2uiAction(call: string, args?: Record<string, any>): A2uiAction;
export function a2uiOpenUrl(url: string): A2uiAction;
export function a2uiButton(
    id: string,
    child: string,
    action: A2uiAction,
    options?: { variant?: 'default' | 'primary' | 'borderless' }
): A2uiComponentNode;
export function a2uiUrlButton(
    id: string,
    child: string,
    url: string,
    options?: { variant?: 'default' | 'primary' | 'borderless' }
): A2uiComponentNode;

export function a2uiTextField(
    id: string,
    label: string,
    options?: { value?: string; variant?: 'shortText' | 'longText' | 'number' | 'obscured'; validationRegexp?: string }
): A2uiComponentNode;
export function a2uiCheckBox(id: string, label: string, value: boolean): A2uiComponentNode;
export function a2uiChoicePicker(
    id: string,
    options: {
        label?: string;
        options: { id: string; label: string }[] | string[];
        value: string[];
        variant?: 'multipleSelection' | 'mutuallyExclusive';
        displayStyle?: 'checkbox' | 'chips';
        filterable?: boolean;
    }
): A2uiComponentNode;
export function a2uiSlider(
    id: string,
    options: { label?: string; min?: number; max: number; value: number }
): A2uiComponentNode;
export function a2uiDateTimeInput(
    id: string,
    options: {
        label?: string;
        value: string;
        enableDate?: boolean;
        enableTime?: boolean;
        min?: string;
        max?: string;
    }
): A2uiComponentNode;

export function a2uiComponent(id: string, component: string, props?: Record<string, any>): A2uiComponentNode;

export function buildA2uiSurface(input?: {
    uuid?: string;
    components: A2uiComponentNode[];
    surfaceId?: string;
    catalogId?: string;
    version?: string;
}): {
    version: string;
    createSurface: { surfaceId: string; catalogId: string; components: A2uiComponentNode[] };
};

export const CATALOG_COMPONENT_NAMES: string[];
export function validateA2uiComponents(components: A2uiComponentNode[]): { ok: boolean; errors: string[] };
export function bloksWidgetSupport(): boolean;
export function buildBloksWidget(
    surface: object,
    options?: { uuid?: string; type?: string; warn?: boolean }
): object | undefined;
export function attachBloksWidget(
    interactiveMessage: Record<string, any>,
    surface: object,
    options?: { uuid?: string; type?: string; warn?: boolean }
): Record<string, any>;
export function resolveBloksWidget(input: any, options?: { uuid?: string }): object | undefined;

export const A2UI: {
    VERSION: string;
    CATALOG: string;
    WIDGET_TYPE: string;
    components: string[];
    surfaceId: typeof a2uiSurfaceId;
    column: typeof a2uiColumn;
    row: typeof a2uiRow;
    list: typeof a2uiList;
    card: typeof a2uiCard;
    text: typeof a2uiText;
    icon: typeof a2uiIcon;
    divider: typeof a2uiDivider;
    image: typeof a2uiImage;
    video: typeof a2uiVideo;
    audio: typeof a2uiAudio;
    tabs: typeof a2uiTabs;
    modal: typeof a2uiModal;
    button: typeof a2uiButton;
    urlButton: typeof a2uiUrlButton;
    textField: typeof a2uiTextField;
    checkBox: typeof a2uiCheckBox;
    choicePicker: typeof a2uiChoicePicker;
    slider: typeof a2uiSlider;
    dateTimeInput: typeof a2uiDateTimeInput;
    action: typeof a2uiAction;
    openUrl: typeof a2uiOpenUrl;
    component: typeof a2uiComponent;
    surface: typeof buildA2uiSurface;
    validate: typeof validateA2uiComponents;
    supported: typeof bloksWidgetSupport;
    widget: typeof buildBloksWidget;
    resolve: typeof resolveBloksWidget;
    attach: typeof attachBloksWidget;
};
