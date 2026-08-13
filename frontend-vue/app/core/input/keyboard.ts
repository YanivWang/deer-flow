/*
  【文件职责】     判断全局快捷键是否来自拥有文本输入的控件。
  【对应 frontend/】 无；M7 keyboard guard
  【架构位置】     L3 input adapter
  【主要导出】     isEditableEventTarget
  【依赖关系】     DOM Element
  【边界与注意】   M7 可访问性保护；当前未列入冻结 L2 公共集合。
*/

/** True when a global shortcut originated from a control that owns text input. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    ),
  );
}
