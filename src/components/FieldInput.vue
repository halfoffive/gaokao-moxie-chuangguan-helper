<script setup>
const props = defineProps({
  field: { type: Object, required: true },
  value: { type: [String, Number], default: '' },
  hint: { type: String, default: '' },
});

const emit = defineEmits(['update']);

const inputId = 'field-' + props.field.key;
const hintId = inputId + '-hint';
const isNumber = props.field.type === 'number';

// 数字字段保持文本输入，避免 number 输入框的空值/spinner 干扰填表。
const onInput = (event) => {
  const raw = event.target.value;
  emit('update', isNumber ? raw.replace(/\D/g, '') : raw);
};
</script>

<template>
  <div class="min-w-0">
    <label :for="inputId" class="block text-[12px] leading-5 text-faint">
      {{ field.label }}
    </label>
    <div class="mt-1 flex items-baseline gap-1.5 border-b border-rule focus-within:border-pine">
      <input
        :id="inputId"
        :data-field="field.key"
        :value="value ?? ''"
        :placeholder="field.placeholder || ''"
        :inputmode="isNumber ? 'numeric' : undefined"
        :pattern="isNumber ? '[0-9]*' : undefined"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :aria-describedby="(hint || field.hint) ? hintId : undefined"
        class="min-w-0 flex-1 border-0 bg-transparent px-0 py-1.5 text-base leading-6 text-ink tabular-nums outline-none placeholder:text-faint sm:text-[15px]"
        @input="onInput"
      />
      <span v-if="field.suffix" class="shrink-0 pb-1.5 text-[11px] text-faint">
        {{ field.suffix }}
      </span>
    </div>
    <p v-if="hint || field.hint" :id="hintId" class="mt-1 text-[11px] leading-4 text-faint">
      {{ hint || field.hint }}
    </p>
  </div>
</template>
