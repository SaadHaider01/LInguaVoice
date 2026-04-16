// ============================================================
// backend/config/a0Curriculum.js
// LinguaVoice — A0 Alphabet Curriculum
// Single source of truth for all A0 lesson groups.
// Used by: routes/lesson.js
// ============================================================

const A0_GROUPS = [
  {
    lesson_index: 0,
    title: "Vowels",
    topic: "vowels",
    letters: ["A", "E", "I", "O", "U"],
    sounds: {
      A: "aah (like Apple)",
      E: "eh (like Egg)",
      I: "ih (like Ink)",
      O: "oh (like Orange)",
      U: "uh (like Umbrella)",
    },
    examples: {
      A: ["Apple", "Ant", "Arm"],
      E: ["Egg", "Elephant", "End"],
      I: ["Ink", "Igloo", "In"],
      O: ["Orange", "October", "On"],
      U: ["Umbrella", "Under", "Up"],
    },
  },
  {
    lesson_index: 1,
    title: "Consonants B C D F G",
    topic: "bcdfg",
    letters: ["B", "C", "D", "F", "G"],
    sounds: {
      B: "buh (like Ball)",
      C: "kuh (like Cat)",
      D: "duh (like Dog)",
      F: "fff (like Fish)",
      G: "guh (like Go)",
    },
    examples: {
      B: ["Ball", "Bus", "Book"],
      C: ["Cat", "Car", "Cup"],
      D: ["Dog", "Door", "Day"],
      F: ["Fish", "Fan", "Foot"],
      G: ["Go", "Girl", "Game"],
    },
  },
  {
    lesson_index: 2,
    title: "Consonants H J K L M",
    topic: "hjklm",
    letters: ["H", "J", "K", "L", "M"],
    sounds: {
      H: "huh (like Hat)",
      J: "juh (like Jam)",
      K: "kuh (like King)",
      L: "lll (like Lion)",
      M: "mmm (like Man)",
    },
    examples: {
      H: ["Hat", "Hand", "Home"],
      J: ["Jam", "Jump", "Job"],
      K: ["King", "Key", "Kid"],
      L: ["Lion", "Leaf", "Love"],
      M: ["Man", "Moon", "Mother"],
    },
  },
  {
    lesson_index: 3,
    title: "Consonants N P Q R S T",
    topic: "npqrst",
    letters: ["N", "P", "Q", "R", "S", "T"],
    sounds: {
      N: "nnn (like Night)",
      P: "puh (like Pan)",
      Q: "kwuh (like Queen)",
      R: "rrr (like Run)",
      S: "sss (like Sun)",
      T: "tuh (like Top)",
    },
    examples: {
      N: ["Night", "Name", "Now"],
      P: ["Pan", "Park", "People"],
      Q: ["Queen", "Quick", "Quiet"],
      R: ["Run", "Rain", "Read"],
      S: ["Sun", "Sea", "Sit"],
      T: ["Top", "Tree", "Time"],
    },
  },
  {
    lesson_index: 4,
    title: "Consonants V W X Y Z",
    topic: "vwxyz",
    letters: ["V", "W", "X", "Y", "Z"],
    sounds: {
      V: "vvv (like Van)",
      W: "wuh (like Water)",
      X: "ks (like Box)",
      Y: "yuh (like Yes)",
      Z: "zzz (like Zoo)",
    },
    examples: {
      V: ["Van", "Voice", "Very"],
      W: ["Water", "Wind", "Work"],
      X: ["Box", "Fox", "Six"],
      Y: ["Yes", "You", "Year"],
      Z: ["Zoo", "Zero", "Zip"],
    },
  },
  {
    lesson_index: 5,
    title: "Blending — First Words",
    topic: "blending",
    letters: [],
    type: "blending",
    words: [
      { word: "CAT", breakdown: "C-A-T", sounds: "kuh-aah-tuh" },
      { word: "DOG", breakdown: "D-O-G", sounds: "duh-oh-guh" },
      { word: "SUN", breakdown: "S-U-N", sounds: "sss-uh-nnn" },
      { word: "RUN", breakdown: "R-U-N", sounds: "rrr-uh-nnn" },
      { word: "BIG", breakdown: "B-I-G", sounds: "buh-ih-guh" },
      { word: "RED", breakdown: "R-E-D", sounds: "rrr-eh-duh" },
    ],
  },
];

/**
 * Get a group by lesson index. Returns undefined if out of range.
 * @param {number} index
 * @returns {object|undefined}
 */
function getA0Group(index) {
  return A0_GROUPS[index];
}

/**
 * Get the first letter (or first blending word) for a group.
 * @param {object} group
 * @returns {string}
 */
function getGroupFirstItem(group) {
  if (group.type === "blending") return group.words[0]?.word || "CAT";
  return group.letters[0] || "A";
}

module.exports = { A0_GROUPS, getA0Group, getGroupFirstItem };
