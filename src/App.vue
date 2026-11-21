<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import FieldInput from './components/FieldInput.vue';
import FingerprintTool from './components/FingerprintTool.vue';
import {
  FIELD_ORDER,
  NUMBER_FIELDS,
  encodePayload,
  normalizePayload,
  parseCode,
  toInteger,
} from './lib/codec.js';
import { readOrCreateDeviceId } from './lib/device.js';
import { FLAG_FIELDS, IDENTITY_FIELDS, SCORE_FIELDS } from './lib/fields.js';
import { makeTemplatePayload, todayKey, weekKey, weekNo } from './lib/template.js';

const initialPayload = normalizePayload(makeTemplatePayload());
const initialCode = encodePayload(initialPayload);

const codeText = ref(initialCode);
const draft = ref(initialPayload);
let baseline = JSON.stringify(draft.value);

const parsed = computed(() => parseCode(codeText.value));
const isValid = computed(() => parsed.value.ok);
const isSample = computed(() => codeText.value === initialCode);
const codeLength = computed(() => codeText.value.trim().length);
const knownFieldCount = computed(
  () => Object.keys(draft.value).filter((key) => FIELD_ORDER.includes(key)).length,
);
const extraKeys = computed(() => Object.keys(draft.value).filter((key) => !FIELD_ORDER.includes(key)));
const missingFieldCount = computed(
  () => FIELD_ORDER.filter((key) => !Object.prototype.hasOwnProperty.call(draft.value, key)).length,
);
const versionNotice = computed(() => {
  if (!isValid.value) return '';
  const version = toInteger(draft.value.v);
  return version === 1
    ? ''
    : '这条成绩码的版本是 v' + (draft.value.v ?? '未知') + '。工具按 v1 字段展示，未识别字段会原样保留。';
});

// 只保留非空错字行用于生成；编辑框本身保留换行，方便继续输入。
const cleanedDraft = computed(() => {
  const source = draft.value;
  const lines = Array.isArray(source.e) ? source.e.map((line) => String(line).trim()).filter(Boolean) : [];
  return normalizePayload({ ...source, e: lines });
});
const cleanedJson = computed(() => JSON.stringify(cleanedDraft.value, null, 2));

const status = computed(() => {
  if (parsed.value.ok) {
    return {
      kind: 'valid',
      title: '校验通过',
      detail: '格式 v' + (draft.value.v ?? '—') + '，' + knownFieldCount.value + ' 个字段，' + codeLength.value + ' 字符',
    };
  }
  if (!codeText.value.trim()) {
    return {
      kind: 'empty',
      title: '等待输入',
      detail: '把成绩码粘贴到上面的框里，或直接改右侧字段生成一条。',
    };
  }
  return {
    kind: 'error',
    title: '无法解码',
    detail: parsed.value.error.message,
  };
});

const formatDuration = (value) => {
  const total = toInteger(value);
  if (total === 0) return '0 秒';
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return seconds + ' 秒';
  return minutes + ' 分 ' + String(seconds).padStart(2, '0') + ' 秒';
};
const durationText = computed(() => formatDuration(draft.value.tc));
const tcHint = computed(() => (draft.value.tc === '' || draft.value.tc == null ? '按秒填写' : '约 ' + durationText.value));

const wrongText = computed(() => (Array.isArray(draft.value.e) ? draft.value.e.join('\n') : ''));
const wrongCount = computed(
  () => (Array.isArray(draft.value.e) ? draft.value.e.map((line) => String(line).trim()).filter(Boolean).length : 0),
);

const patch = (key, value) => {
  draft.value = { ...draft.value, [key]: value };
};

const patchFields = (fields) => {
  draft.value = { ...draft.value, ...fields };
};

const toDateInputValue = (value) => {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return text;
};

const quickDate = computed(() => toDateInputValue(draft.value.d));

const applyQuickDate = (event) => {
  const value = toDateInputValue(event.target.value);
  if (!value) return;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  patchFields({ d: value, w: weekNo(date), k: weekKey(date) });
};

const applyToday = () => {
  const now = new Date();
  patchFields({ d: todayKey(now), w: weekNo(now), k: weekKey(now) });
};

const useLocalDevice = () => {
  patch('dv', readOrCreateDeviceId());
};

const updateField = (key, raw) => {
  if (NUMBER_FIELDS.has(key)) {
    patch(key, raw === '' ? '' : toInteger(raw));
  } else {
    patch(key, raw);
  }
};

const updateFlag = (key, event) => {
  patch(key, event.target.checked ? 1 : 0);
};

const onWrongInput = (event) => {
  patch('e', event.target.value.split('\n'));
};

const applyParsedPayload = (payload) => {
  const normalized = normalizePayload(payload);
  baseline = JSON.stringify(normalized);
  draft.value = normalized;
};

const onCodeInput = (event) => {
  const nextText = event.target.value;
  codeText.value = nextText;
  const result = parseCode(nextText);
  if (result.ok) applyParsedPayload(result.payload);
};

// 字段编辑 → 立即重算；解码写入 draft 时用 baseline 比较避免反向覆盖用户粘贴的原文。
watch(
  draft,
  () => {
    const serialized = JSON.stringify(draft.value);
    if (serialized === baseline) return;
    baseline = serialized;
    codeText.value = encodePayload(cleanedDraft.value);
  },
  { flush: 'sync' },
);

const codeBox = ref(null);
const copyState = ref('idle');
let copyTimer = null;

const fallbackCopy = () => {
  const node = codeBox.value;
  if (!node) throw new Error('没有可复制的输入框');
  node.focus();
  node.select();
  const copied = document.execCommand('copy');
  node.setSelectionRange(node.value.length, node.value.length);
  if (!copied) throw new Error('复制失败');
};

const copyCode = async () => {
  const text = codeText.value.trim();
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy();
    }
    copyState.value = 'copied';
  } catch {
    try {
      fallbackCopy();
      copyState.value = 'copied';
    } catch {
      copyState.value = 'failed';
    }
  }
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyState.value = 'idle';
  }, 1800);
};

const copyLabel = computed(() => {
  if (copyState.value === 'copied') return '已复制';
  if (copyState.value === 'failed') return '复制失败';
  return '复制成绩码';
});

onBeforeUnmount(() => {
  window.clearTimeout(copyTimer);
});
</script>

<template>
  <div class="min-h-screen">
    <main class="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-8 sm:px-6 lg:pt-12">
      <header class="mb-7 border-b-2 border-ink/75 pb-5 sm:mb-9">
        <div class="flex items-start justify-between gap-5 sm:gap-8">
          <h1 class="min-w-0 font-title text-[26px] leading-tight tracking-[0.01em] text-ink sm:text-3xl lg:text-4xl">
            成绩码编解码台
          </h1>
          <div class="flex h-16 w-16 shrink-0 items-center justify-center sm:h-20 sm:w-20" aria-hidden="true">
            <div v-if="isValid" class="seal">
              <span>验</span>
              <span>讫</span>
            </div>
            <span v-else class="font-title text-[12px] tracking-[0.2em] text-faint">待验</span>
          </div>
        </div>
        <p class="mt-2 text-[13px] leading-6 text-faint sm:text-sm">
          古诗文闯关的教师工具。粘贴即解码，改动即重算。
        </p>
      </header>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-8">
        <section
          class="min-w-0 self-start border border-rule bg-sheet p-5 sm:p-6 lg:sticky lg:top-6"
          aria-labelledby="code-heading"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="code-heading" class="font-title text-xl text-ink">成绩码</h2>
              <p class="mt-1 text-xs leading-5 text-faint">学生端结算页最后显示的那串字符</p>
            </div>
            <span
              v-if="isSample"
              class="shrink-0 border border-ochre/60 px-1.5 py-0.5 text-[11px] leading-4 tracking-[0.1em] text-ochre-deep"
            >
              示例
            </span>
          </div>

          <label for="score-code" class="sr-only">成绩码文本</label>
          <textarea
            id="score-code"
            ref="codeBox"
            :value="codeText"
            wrap="soft"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            data-code-input
            aria-describedby="code-help"
            :aria-invalid="status.kind === 'error' ? 'true' : 'false'"
            :class="[
              'mt-4 block h-44 w-full resize-y rounded-sm border bg-[#fffdf6] px-3.5 py-3 font-mono text-base leading-[1.7] tracking-tight text-ink outline-none placeholder:text-faint sm:h-48 sm:text-[12.5px]',
              status.kind === 'error' ? 'border-vermilion focus:border-vermilion' : 'border-rule focus:border-pine',
            ]"
            placeholder="GM1.……"
            @input="onCodeInput"
          />

          <div class="mt-3 min-h-[48px]" role="status" aria-live="polite" data-status>
            <template v-if="status.kind === 'valid'">
              <p class="flex items-center gap-2 text-sm font-medium text-pine">
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-pine" aria-hidden="true"></span>
                {{ status.title }}
              </p>
              <p class="mt-1 text-[11px] leading-5 text-faint tabular-nums">{{ status.detail }}</p>
            </template>
            <template v-else-if="status.kind === 'empty'">
              <p class="text-sm font-medium text-faint">{{ status.title }}</p>
              <p class="mt-1 text-[11px] leading-5 text-faint">{{ status.detail }}</p>
            </template>
            <template v-else>
              <p class="text-sm font-medium text-vermilion">{{ status.title }}</p>
              <p class="mt-1 text-[12px] leading-5 text-ink/85">{{ status.detail }}</p>
              <p class="mt-1 text-[11px] leading-5 text-faint">也可以改右侧任一字段，用当前表单重新生成。</p>
            </template>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-action="copy"
              :disabled="!codeText.trim()"
              class="inline-flex items-center gap-2 rounded-sm border border-pine bg-pine px-3.5 py-2 text-sm font-medium text-sheet transition-colors hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
              @click="copyCode"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.7">
                <rect x="9" y="9" width="11" height="11" rx="1.4" />
                <path d="M5 15V5.8A0.8 0.8 0 0 1 5.8 5H15" />
              </svg>
              {{ copyLabel }}
            </button>
            <span class="text-[11px] text-faint tabular-nums">{{ codeLength }} 字符</span>
          </div>
          <p class="sr-only" role="status" aria-live="polite">
            {{ copyState === 'copied' ? '成绩码已复制' : copyState === 'failed' ? '复制失败，请手动选择成绩码' : '' }}
          </p>

          <details class="mt-5 border-t border-rule pt-3">
            <summary class="cursor-pointer select-none text-xs text-faint transition-colors hover:text-ink">
              查看生成用 JSON
            </summary>
            <pre class="mt-3 max-h-64 overflow-auto border border-rule bg-[#fffdf6] p-3 font-mono text-[11.5px] leading-5 text-ink/80">{{ cleanedJson }}</pre>
          </details>

          <p id="code-help" class="mt-5 border-t border-rule pt-3 text-[11px] leading-5 text-faint">
            可以直接粘贴成绩码，也可以改右侧字段。任何改动都会立刻重算这条字符串。
          </p>
        </section>

        <section class="min-w-0 border border-rule bg-sheet p-5 sm:p-7" aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" class="sr-only">成绩字段</h2>
          <p class="mb-5 text-[12px] leading-5 text-faint">
            左侧成绩码来自学生端结算页。成绩字段与码内 JSON 一一对应；学号指纹区用来核对身份。
          </p>

          <section aria-labelledby="identity-heading">
            <div class="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
              <h3 id="identity-heading" class="font-title text-lg text-pine">身份</h3>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
              <FieldInput
                v-for="field in IDENTITY_FIELDS"
                :key="field.key"
                :field="field"
                :value="draft[field.key]"
                @update="updateField(field.key, $event)"
              />
            </div>
            <div class="mt-4 flex flex-wrap gap-x-7 gap-y-3">
              <label
                v-for="flag in FLAG_FIELDS"
                :key="flag.key"
                class="flex cursor-pointer items-center gap-2 text-[13px] leading-5 text-ink"
              >
                <input
                  type="checkbox"
                  :data-flag="flag.key"
                  :checked="toInteger(draft[flag.key]) === 1"
                  class="h-4 w-4 accent-pine"
                  @change="updateFlag(flag.key, $event)"
                />
                <span>{{ flag.label }}</span>
                <span class="text-[11px] text-faint">{{ flag.hint }}</span>
              </label>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                type="button"
                data-action="local-device"
                class="border border-pine/60 px-2.5 py-1 text-[11px] leading-4 text-pine transition-colors hover:bg-pine hover:text-sheet"
                @click="useLocalDevice"
              >
                使用本机设备标识
              </button>
              <span class="text-[11px] leading-5 text-faint">复用本浏览器保存的随机 dv；没有就生成一个，仅在你点击时保存。</span>
            </div>
          </section>

          <section class="mt-7 border-t border-rule pt-6" aria-labelledby="fingerprint-heading">
            <div class="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
              <h3 id="fingerprint-heading" class="font-title text-lg text-pine">学号指纹</h3>
            </div>
            <FingerprintTool :fingerprint="String(draft.u ?? '')" @apply="updateField('u', $event)" />
          </section>

          <section class="mt-7 border-t border-rule pt-6" aria-labelledby="score-heading">
            <div class="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
              <h3 id="score-heading" class="font-title text-lg text-pine">本周成绩</h3>
              <div class="flex flex-wrap items-center gap-2">
                <label for="quick-date" class="sr-only">按日期填入成绩日期、周次和周键</label>
                <input
                  id="quick-date"
                  data-quick-date
                  type="date"
                  :value="quickDate"
                  class="w-[124px] border-0 border-b border-rule bg-transparent px-0 py-1 text-[12px] leading-5 text-ink outline-none focus:border-pine"
                  @input="applyQuickDate"
                />
                <button
                  type="button"
                  data-action="today"
                  class="border border-pine/60 px-2 py-1 text-[11px] leading-4 text-pine transition-colors hover:bg-pine hover:text-sheet"
                  @click="applyToday"
                >
                  用今天
                </button>
              </div>
            </div>
            <p class="mt-2 text-[11px] leading-5 text-faint">选日期或点「用今天」，会同时更新日期、周次和周键。</p>
            <div class="mt-4 grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
              <FieldInput
                v-for="field in SCORE_FIELDS"
                :key="field.key"
                :field="field"
                :value="draft[field.key]"
                :hint="field.key === 'tc' ? tcHint : ''"
                @update="updateField(field.key, $event)"
              />
            </div>
          </section>

          <section class="mt-7 border-t border-rule pt-6" aria-labelledby="wrong-heading">
            <div class="flex items-baseline justify-between gap-3">
              <h3 id="wrong-heading" class="font-title text-lg text-pine">错字记录</h3>
              <span class="text-[11px] text-faint tabular-nums">{{ wrongCount }} 条</span>
            </div>
            <label for="wrong-lines" class="mt-2 block text-[12px] leading-5 text-faint">
              每行一条「正确字|篇名」，换行即增删；生成时只保留非空行。
            </label>
            <textarea
              id="wrong-lines"
              :value="wrongText"
              rows="4"
              spellcheck="false"
              autocomplete="off"
              class="mt-2 w-full resize-y rounded-sm border border-rule bg-[#fffdf6] px-3 py-2 text-base leading-7 text-ink outline-none placeholder:text-faint focus:border-pine sm:text-[13px]"
              placeholder="例如：霭|归园田居·其一"
              @input="onWrongInput"
            ></textarea>
          </section>

          <div
            v-if="isValid && (versionNotice || extraKeys.length || missingFieldCount)"
            class="mt-5 space-y-2 border-l-2 border-ochre/70 bg-ochre/5 px-3 py-2.5 text-[11.5px] leading-5 text-faint"
          >
            <p v-if="versionNotice">{{ versionNotice }}</p>
            <p v-if="missingFieldCount">这条成绩码缺少 {{ missingFieldCount }} 个常见字段，生成时不会自动补默认值。</p>
            <p v-if="extraKeys.length">
              另有 {{ extraKeys.length }} 个未识别字段（{{ extraKeys.join('、') }}），生成时原样保留。
            </p>
          </div>

          <p class="mt-6 border-t border-rule pt-3 text-[11px] leading-5 text-faint">
            改动任意一项，左侧成绩码立即重算。生成结果与文件中的学生端算法一致。
          </p>
        </section>
      </div>

      <footer class="mt-8 flex flex-col gap-2 border-t border-rule pt-4 text-[11px] leading-5 text-faint sm:flex-row sm:items-start sm:justify-between">
        <p>成绩码格式 GM1：base64url 载荷加 5 位 djb2 校验</p>
        <p>解码只在本机浏览器完成，不会上传。</p>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.seal {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-vermilion);
  color: var(--color-vermilion);
  font-family: var(--font-title);
  font-size: 18px;
  line-height: 1.05;
  box-shadow: inset 0 0 0 2px rgba(176, 58, 41, 0.18);
  mix-blend-mode: multiply;
  transform: rotate(-4deg);
  animation: stamp-in 320ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
}

.seal::before {
  position: absolute;
  inset: 5px;
  border: 1px solid rgba(176, 58, 41, 0.5);
  content: '';
}

@media (min-width: 640px) {
  .seal {
    font-size: 20px;
  }
}

@keyframes stamp-in {
  0% {
    opacity: 0;
    transform: scale(1.35) rotate(-8deg);
  }
  60% {
    opacity: 0.95;
    transform: scale(0.96) rotate(-3deg);
  }
  100% {
    opacity: 0.92;
    transform: scale(1) rotate(-4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .seal {
    animation: none;
    transform: rotate(-4deg);
  }
}
</style>
