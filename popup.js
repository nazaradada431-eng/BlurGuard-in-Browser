const api = globalThis.browser ?? globalThis.chrome;
const DEFAULT_WORDS = ["девственница", "девственник", "екстремізм", "екстреміст", "нацистский", "фашистский", "extremism", "extremist", "неонацизм", "неонацист", "autistik", "neo-nazi", "нацистка", "фашистка", "cuckold", "fascism", "fascist", "neonazi", "pidoras", "ватники", "москали", "москаль", "пидорас", "підорас", "сионist", "сионист", "сіоніст", "autist", "faggot", "nazism", "nazist", "nigger", "petukh", "retard", "virgin", "аутист", "аутіст", "вагина", "ватник", "куколд", "нацизм", "нацист", "ниггер", "фашизм", "фашист", "хиджаб", "debil", "gomik", "incel", "nigga", "pedik", "pidor", "гомик", "гомік", "дебил", "дебіл", "инцел", "конча", "педик", "педік", "петух", "пидор", "пизда", "підор", "хохлы", "хохол", "cuck", "cunt", "naga", "nazi", "simp", "даун", "жиды", "нага", "нига", "симп", "хачи", "жид", "хач"];

const warning = document.getElementById("warning");
const settings = document.getElementById("settings");
const confirmButton = document.getElementById("confirm");
const words = document.getElementById("words");
const hotkey = document.getElementById("hotkey");
const duration = document.getElementById("duration");
const save = document.getElementById("save");
const status = document.getElementById("status");

confirmButton.onclick = async () => {
  warning.classList.add("hidden");
  settings.classList.remove("hidden");

  const data = await api.storage.sync.get({
    blockedWords: DEFAULT_WORDS,
    revealHotkey: "ctrl",
    revealDuration: 5000
  });

  words.value = data.blockedWords.join("\n");
  hotkey.value = data.revealHotkey;
  duration.value = String(data.revealDuration);
};

save.onclick = async () => {
  const list = [...new Set(
    words.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  )];

  await api.storage.sync.set({
    blockedWords: list,
    revealHotkey: hotkey.value,
    revealDuration: Number(duration.value)
  });

  status.textContent = `Сохранено: ${list.length} слов/фраз.`;
  setTimeout(() => status.textContent = "", 2000);
};