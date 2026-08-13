<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import {
  createInitialOpacities,
  prefersReducedMotion,
} from "./flickering-grid";

const props = withDefaults(
  defineProps<{
    squareSize?: number;
    gridGap?: number;
    flickerChance?: number;
    color?: string;
    width?: number;
    height?: number;
    maxOpacity?: number;
  }>(),
  {
    squareSize: 4,
    gridGap: 6,
    flickerChance: 0.3,
    color: "rgb(0, 0, 0)",
    width: undefined,
    height: undefined,
    maxOpacity: 0.3,
  },
);

const container = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let frame = 0;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let visible = true;
let lastTime = 0;

function colorPrefix(context: CanvasRenderingContext2D) {
  context.fillStyle =
    props.color === "currentColor" && container.value
      ? getComputedStyle(container.value).color
      : props.color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  context.clearRect(0, 0, 1, 1);
  return `rgba(${red}, ${green}, ${blue},`;
}

function paint() {
  cancelAnimationFrame(frame);
  const node = canvas.value;
  const host = container.value;
  const context = node?.getContext("2d");
  if (!node || !host || !context) return;

  const width = props.width ?? host.clientWidth;
  const height = props.height ?? host.clientHeight;
  const dpr = globalThis.devicePixelRatio || 1;
  node.width = Math.max(1, Math.round(width * dpr));
  node.height = Math.max(1, Math.round(height * dpr));
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
  const step = props.squareSize + props.gridGap;
  const columns = Math.floor(width / step);
  const rows = Math.floor(height / step);
  const squares = createInitialOpacities(columns * rows, props.maxOpacity);
  const prefix = colorPrefix(context);
  const reduced = prefersReducedMotion();

  const draw = () => {
    context.clearRect(0, 0, node.width, node.height);
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const index = column * rows + row;
        context.fillStyle = `${prefix}${squares[index]})`;
        context.fillRect(
          column * step * dpr,
          row * step * dpr,
          props.squareSize * dpr,
          props.squareSize * dpr,
        );
      }
    }
  };

  const animate = (time: number) => {
    if (!visible) return;
    const delta = Math.min(0.1, (time - lastTime) / 1000);
    lastTime = time;
    for (let index = 0; index < squares.length; index += 1) {
      if (Math.random() < props.flickerChance * delta) {
        squares[index] = Math.random() * props.maxOpacity;
      }
    }
    draw();
    frame = requestAnimationFrame(animate);
  };

  draw();
  if (!reduced && visible) frame = requestAnimationFrame(animate);
}

onMounted(() => {
  void nextTick(paint);
  if (container.value && "ResizeObserver" in globalThis) {
    resizeObserver = new ResizeObserver(paint);
    resizeObserver.observe(container.value);
  }
  if (canvas.value && "IntersectionObserver" in globalThis) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      paint();
    });
    intersectionObserver.observe(canvas.value);
  }
});
watch(
  () => [props.color, props.maxOpacity, props.squareSize, props.gridGap],
  paint,
);
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});
</script>

<template>
  <div
    ref="container"
    data-effect="flickering-grid"
    aria-hidden="true"
    class="h-full w-full overflow-hidden"
  >
    <canvas ref="canvas" class="pointer-events-none block" />
  </div>
</template>
