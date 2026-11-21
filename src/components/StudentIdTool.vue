<script setup>
import { computed, nextTick, ref, watch } from 'vue';

import { fingerprintOf, findFingerprintMatches } from '../lib/student-id.js';

const props = defineProps({
  fingerprint: { type: String, default: '' },
});
const emit = defineEmits(['apply']);

const studentCode = ref('');
const prefix = ref('2024');
const candidates = ref([]);
const searching = ref(false);
const message = ref('');

const currentFingerprint = computed(() => String(props.fingerprint ?? '').trim().toLowerCase());
const currentValid = computed(() => /^[0-9a-f]{5}$/.test(currentFingerprint.value));
const computedFingerprint = computed(() => {
  const code = studentCode.value.trim();
  return code ? fingerprintOf(code) : '';
});
const shownCandidates = computed(() => candidates.value.slice(0, 20));
const hiddenCount = computed(() => Math.max(0, candidates.value.length - shownCandidates.value.length));

const onStudentInput = (event) => {
  studentCode.value = event.target.value.replace(/\s+/g, '');
};

const onPrefixInput = (event) => {
  prefix.value = event.target.value.replace(/\D/g, '').slice(0, 9);
  candidates.value = [];
  message.value = '';
};

const applyFingerprint = async () => {
  if (!computedFingerprint.value) return;
  emit('apply', computedFingerprint.value);
  // 父组件更新 u 后会清空结果区，等一轮再给用户确认。
  await nextTick();
  message.value = '已填入 u 字段。';
};

const infer = async () => {
  if (!currentValid.value) {
    message.value = '当前 u 不是 5 位十六进制指纹；先填入或手动修改 u。';
    return;
  }
  if (!/^\d{4,9}$/.test(prefix.value)) {
    message.value = '学号前缀需要 4–9 位数字。';
    return;
  }

  searching.value = true;
  candidates.value = [];
  message.value = '';
  await nextTick();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  const started = performance.now();
  const result = findFingerprintMatches({
    fingerprint: currentFingerprint.value,
    prefix: prefix.value,
  });
  const elapsed = Math.max(1, Math.round(performance.now() - started));
  searching.value = false;

  if (!result.ok) {
    message.value = result.error;
    return;
  }

  candidates.value = result.matches;
  const total = result.searched.toLocaleString('zh-CN');
  if (result.matches.length === 0) {
    message.value = '在 ' + prefix.value + ' 开头的 ' + total + ' 个学号中没有命中（' + elapsed + ' ms）。可以缩短前缀再试。';
    return;
  }

  message.value =
    '在 ' + total + ' 个学号中命中 ' + result.matches.length + ' 个候选（' + elapsed +
    ' ms）。指纹只有 20 bit，且对连续学号不敏感；结果可能成批相同，请结合班级/姓名或已知学号核对。';
  if (result.truncated) {
    message.value += ' 候选过多，只保留前 ' + result.matches.length + ' 个。';
  }
};

const pickCandidate = (code) => {
  studentCode.value = code;
  message.value = '已把候选填入学号框；核对它的指纹与当前 u 相同后再使用。';
};

watch(
  () => props.fingerprint,
  () => {
    candidates.value = [];
    message.value = '';
  },
);
</script>

<template>
  <div class="space-y-4">
    <p class="text-[11.5px] leading-5 text-faint">
      u 字段是 <code class="font-mono text-[11px]">crc5("GM2026|学号")</code> 的 5 位结果，不是可逆加密。先算学号对应的指纹，或在已知前几位后穷举候选。
    </p>
    <p class="border-l-2 border-ochre/70 bg-ochre/5 px-2.5 py-2 text-[11px] leading-5 text-faint">
      这个指纹对连续学号很不敏感，逆推结果常成批相同；它只能用来缩小范围，不能单独认定学生。可靠做法是拿到学号后在这里正向核对。
    </p>

    <div>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div class="min-w-0">
          <label for="fp-student" class="block text-[12px] leading-5 text-faint">学号转指纹</label>
          <div class="mt-1 flex items-baseline gap-2 border-b border-rule focus-within:border-pine">
            <input
              id="fp-student"
              data-fp-student
              :value="studentCode"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="例如 2024123456"
              aria-describedby="fp-student-hint"
              class="min-w-0 flex-1 border-0 bg-transparent px-0 py-1.5 font-mono text-base text-ink tabular-nums outline-none placeholder:font-sans placeholder:text-faint sm:text-[13px]"
              @input="onStudentInput"
            />
            <span class="shrink-0 font-mono text-[13px] tabular-nums text-pine" data-fp-result>
              {{ computedFingerprint || '—' }}
            </span>
          </div>
        </div>
        <button
          type="button"
          data-fp-apply
          :disabled="!computedFingerprint"
          class="h-fit w-full border border-pine px-3 py-1.5 text-[12px] leading-4 text-pine transition-colors hover:bg-pine hover:text-sheet disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          @click="applyFingerprint"
        >
          填入 u
        </button>
      </div>
      <p id="fp-student-hint" class="mt-1 text-[11px] leading-4 text-faint">输入学号后实时计算，用于核对；TEST01 也可以。</p>
    </div>

    <div class="border-t border-rule pt-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-0 flex-1">
          <label for="fp-prefix" class="block text-[12px] leading-5 text-faint">学号前缀（4–9 位）</label>
          <input
            id="fp-prefix"
            data-fp-prefix
            :value="prefix"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="9"
            autocomplete="off"
            spellcheck="false"
            class="mt-1 block w-full border-0 border-b border-rule bg-transparent px-0 py-1.5 font-mono text-base tabular-nums text-ink outline-none focus:border-pine sm:text-[13px]"
            @input="onPrefixInput"
          />
        </div>
        <button
          type="button"
          data-fp-infer
          :disabled="searching"
          class="h-fit border border-pine/60 px-3 py-1.5 text-[12px] leading-4 text-pine transition-colors hover:bg-pine hover:text-sheet disabled:cursor-not-allowed disabled:opacity-40"
          @click="infer"
        >
          {{ searching ? '推算中…' : '按指纹推算' }}
        </button>
      </div>

      <p class="mt-2 text-[11px] leading-5 text-faint">
        当前 u：<span class="font-mono" :class="currentValid ? 'text-pine' : 'text-vermilion'">{{ currentFingerprint || '—' }}</span>。
        前缀越短范围越大；4 位会扫描 100 万个学号。
      </p>

      <p v-if="message" data-fp-message role="status" aria-live="polite" class="mt-2 border-l-2 border-ochre/70 bg-ochre/5 px-2.5 py-2 text-[11.5px] leading-5 text-faint">
        {{ message }}
      </p>

      <ul v-if="shownCandidates.length" data-fp-candidates class="mt-3 divide-y divide-rule border-y border-rule">
        <li v-for="code in shownCandidates" :key="code" class="flex items-center justify-between gap-3 py-1.5">
          <code class="select-all font-mono text-[13px] tabular-nums text-ink">{{ code }}</code>
          <button
            type="button"
            class="shrink-0 text-[11px] text-pine underline decoration-pine/40 underline-offset-2 hover:decoration-pine"
            @click="pickCandidate(code)"
          >
            填入学号
          </button>
        </li>
      </ul>
      <p v-if="hiddenCount" class="mt-2 text-[11px] leading-5 text-faint">
        还有 {{ hiddenCount }} 个候选未显示，请缩窄学号前缀。
      </p>
    </div>
  </div>
</template>
