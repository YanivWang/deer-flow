<template>
  <WorkspaceNavShell>
    <section class="workspace-home" data-testid="vue-workspace-home">
      <h1>DeerFlow 工作区</h1>
      <p>选择一个工作区入口继续。</p>
      <div class="workspace-home__cards">
        <NuxtLink class="workspace-home__card" data-testid="vue-workspace-card-chat" to="/workspace/chats/new">
          开始对话
        </NuxtLink>
        <NuxtLink class="workspace-home__card" data-testid="vue-workspace-card-agents" to="/workspace/agents">
          管理智能体
        </NuxtLink>
        <NuxtLink class="workspace-home__card" data-testid="vue-workspace-card-scheduled" to="/workspace/scheduled-tasks">
          计划任务
        </NuxtLink>
        <NuxtLink class="workspace-home__card" data-testid="vue-workspace-card-settings" to="/workspace/settings">
          设置
        </NuxtLink>
      </div>
    </section>
  </WorkspaceNavShell>
</template>
