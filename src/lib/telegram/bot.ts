const TELEGRAM_API = "https://api.telegram.org/bot";

function getToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

async function callApi(method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${TELEGRAM_API}${getToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }
  return data.result;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: {
    replyMarkup?: unknown;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  }
) {
  return callApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode || "HTML",
    reply_markup: options?.replyMarkup,
  });
}

export async function sendDocument(
  chatId: string | number,
  document: Buffer | string,
  filename: string,
  options?: { caption?: string; replyMarkup?: unknown }
) {
  const token = getToken();
  const formData = new FormData();
  formData.append("chat_id", String(chatId));

  if (Buffer.isBuffer(document)) {
    formData.append("document", new Blob([new Uint8Array(document)]), filename);
  } else {
    formData.append("document", document);
  }

  if (options?.caption) formData.append("caption", options.caption);
  if (options?.replyMarkup) {
    formData.append("reply_markup", JSON.stringify(options.replyMarkup));
  }

  const response = await fetch(`${TELEGRAM_API}${token}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram API error: ${data.description}`);
  return data.result;
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
) {
  return callApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function setWebhook(url: string, secretToken?: string) {
  return callApi("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
  });
}

export function buildInlineKeyboard(
  buttons: { text: string; callbackData?: string; url?: string }[][]
) {
  return {
    inline_keyboard: buttons.map((row) =>
      row.map((btn) => ({
        text: btn.text,
        ...(btn.callbackData
          ? { callback_data: btn.callbackData }
          : { url: btn.url }),
      }))
    ),
  };
}

export async function setMyCommands(
  commands: { command: string; description: string }[],
  scope?: { type: string; chat_id?: number }
) {
  return callApi("setMyCommands", {
    commands,
    scope,
    language_code: "uk",
  });
}

export async function setupBotCommands(ownerChatId?: string) {
  await setMyCommands([
    { command: "book", description: "Записатися на прийом" },
    { command: "my_appointments", description: "Мої записи" },
    { command: "cancel", description: "Скасувати запис" },
  ]);

  if (ownerChatId) {
    await setMyCommands(
      [
        { command: "today", description: "Записи на сьогодні" },
        { command: "admin_cancel", description: "Скасувати запис клієнта" },
        { command: "book", description: "Записатися на прийом" },
        { command: "my_appointments", description: "Мої записи" },
        { command: "cancel", description: "Скасувати запис" },
      ],
      { type: "chat", chat_id: Number(ownerChatId) }
    );
  }
}

export function buildReplyKeyboard(
  buttons: { text: string; requestContact?: boolean }[][],
  options?: { oneTimeKeyboard?: boolean; resizeKeyboard?: boolean }
) {
  return {
    keyboard: buttons.map((row) =>
      row.map((btn) => ({
        text: btn.text,
        request_contact: btn.requestContact,
      }))
    ),
    one_time_keyboard: options?.oneTimeKeyboard ?? true,
    resize_keyboard: options?.resizeKeyboard ?? true,
  };
}
