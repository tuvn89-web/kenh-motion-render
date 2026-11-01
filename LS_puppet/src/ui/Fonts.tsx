import React, {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import '@fontsource/cormorant-sc/700.css';
import '@fontsource/im-fell-english-sc/400.css';
export const useFonts = () => {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([document.fonts.load('700 40px "Cormorant SC"'), document.fonts.load('400 40px "IM Fell English SC"')]).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
};
