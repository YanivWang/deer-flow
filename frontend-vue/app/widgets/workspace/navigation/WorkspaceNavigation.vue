<script setup lang="ts">
import { Bot, CalendarClock, MessagesSquare, MessageSquarePlus } from "lucide-vue-next";
import type { WorkspaceNavigationController } from "../../../features/workspace/navigation/use-workspace-navigation";

const props = defineProps<{
  navigation: WorkspaceNavigationController;
  embedded?: boolean;
}>();

const activeNavItem = props.navigation.activeNavItem;
const agentsFeatureTooltipVisible = props.navigation.agentsFeatureTooltipVisible;
const isCollapsed = props.navigation.isCollapsed;
const isMobileOpen = props.navigation.isMobileOpen;
const density = props.navigation.density;
const navItems = props.navigation.navItems;
const visibleNavItems = props.navigation.visibleNavItems;
</script>

<template>
  <nav
    class="workspace-nav-shell__sidebar"
    :class="{
      'workspace-nav-shell__sidebar--embedded': props.embedded,
      'workspace-nav-shell__sidebar--mobile-open': isMobileOpen,
    }"
    data-testid="vue-workspace-nav"
  >
    <div class="workspace-nav-shell__mobile-header">
      <span class="workspace-nav-shell__mobile-title">工作区导航</span>
      <button
        class="workspace-nav-shell__mobile-close"
        data-testid="vue-workspace-nav-mobile-close"
        type="button"
        @click="props.navigation.closeMobileNav"
      >
        关闭
      </button>
    </div>
    <NuxtLink
      class="workspace-nav-shell__brand"
      data-testid="vue-workspace-nav-home"
      to="/workspace"
      @click="props.navigation.closeMobileNav"
    >
      <span class="workspace-nav-shell__label">DeerFlow</span>
      <span class="workspace-nav-shell__mark">DF</span>
    </NuxtLink>
    <div class="workspace-nav-shell__controls">
      <button
        class="workspace-nav-shell__control"
        data-testid="vue-workspace-nav-collapse"
        type="button"
        @click="props.navigation.toggleCollapsed"
      >
        {{ isCollapsed ? "展开" : "折叠" }}
      </button>
      <button
        class="workspace-nav-shell__control"
        data-testid="vue-workspace-nav-density"
        type="button"
        @click="props.navigation.toggleDensity"
      >
        {{ density === "compact" ? "舒适" : "紧凑" }}
      </button>
    </div>
    <div class="workspace-nav-shell__links">
      <NuxtLink
        v-for="item in visibleNavItems"
        v-show="!(props.embedded && (item.id === 'settings' || item.id === 'new-chat'))"
        :key="item.id"
        class="workspace-nav-shell__link"
        :class="{ 'workspace-nav-shell__link--active': activeNavItem?.id === item.id }"
        :data-testid="`vue-workspace-nav-${item.id}`"
        :to="item.to"
        @click="props.navigation.closeMobileNav"
      >
        <MessageSquarePlus v-if="item.id === 'new-chat'" :size="20" aria-hidden="true" />
        <MessagesSquare v-else-if="item.id === 'chats'" :size="20" aria-hidden="true" />
        <Bot v-else-if="item.id === 'agents'" :size="20" aria-hidden="true" />
        <CalendarClock v-else :size="20" aria-hidden="true" />
        <span class="workspace-nav-shell__label">{{ item.label }}</span>
      </NuxtLink>
      <span
        v-if="!visibleNavItems.some((item) => item.id === 'agents')"
        class="workspace-nav-shell__feature-disabled"
        data-testid="vue-workspace-nav-agents-disabled"
        @mouseenter="props.navigation.showAgentsFeatureTooltip"
        @mouseleave="props.navigation.hideAgentsFeatureTooltip"
        @focusin="props.navigation.showAgentsFeatureTooltip"
        @focusout="props.navigation.hideAgentsFeatureTooltip"
      >
        <button
          class="workspace-nav-shell__link workspace-nav-shell__link--disabled"
          data-feature-disabled="true"
          data-testid="vue-workspace-nav-agents"
          type="button"
          @focusin="props.navigation.showAgentsFeatureTooltip"
          @blur="props.navigation.hideAgentsFeatureTooltip"
          @click="props.navigation.showAgentsFeatureTooltip"
        >
          <Bot :size="20" aria-hidden="true" />
          <span class="workspace-nav-shell__label">{{ navItems.find((item) => item.id === 'agents')?.label }}</span>
        </button>
        <span v-if="agentsFeatureTooltipVisible" class="workspace-nav-shell__feature-tooltip" role="tooltip">
          {{ $t("sidebar.agentsDisabledTooltip") }}
        </span>
      </span>
    </div>
  </nav>
</template>
