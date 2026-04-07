/**
 * frontend/src/utils/languageDetector.js
 * 
 * Utility to guess the user's native language based on browser locale.
 * Fallback to 'other_lang' if no mapping is found.
 */
export const guessNativeLanguage = () => {
    const locale = navigator.language || navigator.userLanguage || "en-US";
    const primary = locale.split("-")[0].toLowerCase();

    const mapping = {
        "hi": "hindi",
        "ur": "urdu",
        "bn": "bengali",
        "ta": "tamil",
        "te": "telugu",
        "mr": "marathi",
        "pa": "punjabi",
        "ar": "arabic",
        "es": "spanish",
        "zh": "mandarin"
    };

    return mapping[primary] || "other_lang";
};
