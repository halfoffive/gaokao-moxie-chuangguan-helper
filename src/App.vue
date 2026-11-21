<script setup>
const version = '0.1.0';
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-12">
    <p class="font-title text-sm text-faint">古诗文闯关 · 教师工具</p>
    <h1 class="mt-2 font-title text-4xl text-ink">成绩码编解码台</h1>
    <p class="mt-3 max-w-xl text-sm leading-7 text-faint">
      正在搭建。稍后这里会自动解码成绩码，并在改动字段时重算。v{{ version }}
    </p>
  </main>
</template>
