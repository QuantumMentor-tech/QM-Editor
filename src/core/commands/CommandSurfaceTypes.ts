import { CommandContext } from './CommandTypes';

export type SurfaceId =
  | 'menubar'
  | 'toolbar'
  | 'contextmenu:explorer'
  | 'contextmenu:editor'
  | 'contextmenu:tab'
  | 'contextmenu:terminal'
  | 'contextmenu:task'
  | 'contextmenu:problem'
  | 'overflow';

export type MenuBarCategory =
  | 'file'
  | 'edit'
  | 'selection'
  | 'view'
  | 'go'
  | 'terminal'
  | 'tasks'
  | 'sourcecontrol'
  | 'help';

export interface SurfaceItem {
  commandId: string;
  group?: string;
  order?: number;
  icon?: string;
  labelOverride?: string;
  when?: (ctx: CommandContext) => boolean;
  isChecked?: (ctx: CommandContext) => boolean;
  submenu?: SurfaceItem[];
}

export interface MenuBarDefinition {
  id: MenuBarCategory;
  label: string;
  items: SurfaceItem[];
}

export interface ResolvedSurfaceItem {
  commandId: string;
  label: string;
  shortcut?: string;
  formattedShortcut?: string;
  group?: string;
  order: number;
  icon?: string;
  enabled: boolean;
  checked?: boolean;
  submenu?: ResolvedSurfaceItem[];
}

export interface ResolvedMenuGroup {
  groupId: string;
  items: ResolvedSurfaceItem[];
}
