export const A2UI_VERSION: string;
export const A2UI_BASIC_CATALOG: string;
export const A2UI_WIDGET_TYPE: string;
export function a2uiSurfaceId(uuid: string): string;

export type A2uiComponentNode = { id: string; component: string; [key: string]: any };

export function a2uiColumn(id: string, children: string[]): A2uiComponentNode;
export function a2uiRow(id: string, children: string[]): A2uiComponentNode;
export function a2uiCard(id: string, child: string): A2uiComponentNode;
export function a2uiText(id: string, value: string, variant?: string): A2uiComponentNode;
export function a2uiDivider(id: string): A2uiComponentNode;
export function a2uiImage(
    id: string,
    url: string,
    options?: { variant?: string; fit?: string }
): A2uiComponentNode;
export function a2uiUrlButton(
    id: string,
    child: string,
    url: string,
    options?: { variant?: string }
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
    surfaceId: typeof a2uiSurfaceId;
    column: typeof a2uiColumn;
    row: typeof a2uiRow;
    card: typeof a2uiCard;
    text: typeof a2uiText;
    divider: typeof a2uiDivider;
    image: typeof a2uiImage;
    urlButton: typeof a2uiUrlButton;
    component: typeof a2uiComponent;
    surface: typeof buildA2uiSurface;
    validate: typeof validateA2uiComponents;
    supported: typeof bloksWidgetSupport;
    widget: typeof buildBloksWidget;
    resolve: typeof resolveBloksWidget;
    attach: typeof attachBloksWidget;
};
