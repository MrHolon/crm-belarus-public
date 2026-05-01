import {
  ActionIcon,
  Menu,
  Tooltip,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { IconDeviceLaptop, IconMoon, IconSun } from '@tabler/icons-react';

const LABELS: Record<MantineColorScheme, string> = {
  light: 'Светлая',
  dark: 'Тёмная',
  auto: 'Как в системе',
};

/**
 * Theme switcher with three options: light / dark / system.
 * Selection persists in `localStorage` via Mantine (key `mantine-color-scheme-value`).
 */
export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const icon =
    colorScheme === 'light' ? (
      <IconSun size={18} />
    ) : colorScheme === 'dark' ? (
      <IconMoon size={18} />
    ) : (
      <IconDeviceLaptop size={18} />
    );

  return (
    <Menu position="bottom-end" shadow="md" width={180}>
      <Menu.Target>
        <Tooltip label={`Тема: ${LABELS[colorScheme]}`} withArrow>
          <ActionIcon
            variant="subtle"
            size="lg"
            aria-label="Переключить тему"
          >
            {icon}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Тема оформления</Menu.Label>
        <Menu.Item
          leftSection={<IconSun size={16} />}
          onClick={() => setColorScheme('light')}
          disabled={colorScheme === 'light'}
        >
          {LABELS.light}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMoon size={16} />}
          onClick={() => setColorScheme('dark')}
          disabled={colorScheme === 'dark'}
        >
          {LABELS.dark}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconDeviceLaptop size={16} />}
          onClick={() => setColorScheme('auto')}
          disabled={colorScheme === 'auto'}
        >
          {LABELS.auto}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
