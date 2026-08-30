<script setup lang="ts">
/*
  【文件职责】     为 Settings 的 destructive/preview/form 动作提供受控确认对话框。
  【架构位置】     L3 Settings UI adapter
  【主要导出】     默认 SettingsActionDialog 组件
  【依赖关系】     ui/alert-dialog · ui/dialog
  【边界与注意】   pending 时不能关闭或重复确认；不使用 window.confirm。
                   destructive 走 alertdialog、其余走 dialog：alertdialog 是给
                   「只有确认/取消两个出口」的中断用的，装着表单控件时用它会让读屏器
                   把整张表单读成一条警告。判据就是 destructive 这一个 prop。
*/
import { computed } from "vue";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  destructive?: boolean;
  confirmDisabled?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();

const confirmBlocked = computed(
  () => Boolean(props.pending) || Boolean(props.confirmDisabled),
);

/**
 * 没有 description 时显式摘掉 aria-describedby。
 * Reka 无条件把它指向 description 的 id，而那个节点在 v-if 下并不存在——
 * 留着就是一个悬空 IDREF。缺省 `{}` 时 Reka 自己的值原样保留。
 */
const describedBy = computed(() =>
  props.description ? {} : { "aria-describedby": undefined },
);

/**
 * 关闭的唯一入口：Escape、遮罩点击与关闭按钮都汇到这里。
 * pending 期间 Reka 的关闭请求被拒绝，同时下面的按钮也一起 disabled，
 * 用户不会被困在一个既关不掉也点不动的框里。
 */
function onOpenChange(next: boolean) {
  if (!next && !props.pending) emit("cancel");
}
</script>

<template>
  <AlertDialog
    v-if="props.destructive"
    :open="props.open"
    @update:open="onOpenChange"
  >
    <AlertDialogContent
      v-bind="{ ...$attrs, ...describedBy }"
      @escape-key-down="props.pending && $event.preventDefault()"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{{ props.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="props.description">
          {{ props.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div class="space-y-3">
        <slot />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="props.pending" @click="emit('cancel')">
          {{ props.cancelLabel }}
        </AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="confirmBlocked"
          @click="emit('confirm')"
        >
          {{ props.pending ? "…" : props.confirmLabel }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <Dialog v-else :open="props.open" @update:open="onOpenChange">
    <DialogContent
      v-bind="{ ...$attrs, ...describedBy }"
      :close-label="$i18n.t.value.primitives.close"
      @escape-key-down="props.pending && $event.preventDefault()"
      @pointer-down-outside="props.pending && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>{{ props.title }}</DialogTitle>
        <DialogDescription v-if="props.description">
          {{ props.description }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-3">
        <slot />
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="props.pending"
          @click="emit('cancel')"
        >
          {{ props.cancelLabel }}
        </Button>
        <Button :disabled="confirmBlocked" @click="emit('confirm')">
          {{ props.pending ? "…" : props.confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
