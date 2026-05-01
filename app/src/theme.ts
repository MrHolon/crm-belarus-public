import { createTheme, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#eef4ff',
  '#dbe4ff',
  '#b5c6ff',
  '#8ea7ff',
  '#6d8dff',
  '#587dff',
  '#4b74ff',
  '#3c62e4',
  '#3456cc',
  '#2649b4',
];

export const theme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand,
  },
  fontFamily:
    'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer',
});
