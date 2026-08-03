<script setup lang="ts">
import AgentGallery from "../../../widgets/workspace/agents/AgentGallery.vue";
import WorkspaceNavShell from "../../../widgets/workspace/navigation/WorkspaceNavShell.vue";
import { useAgentsGallery } from "../../../features/agents/use-agents-gallery";

const gallery = useAgentsGallery();
</script>

<template>
  <WorkspaceNavShell>
    <AgentGallery :gallery="gallery" />
  </WorkspaceNavShell>
</template>
