import { Picker as RNPicker } from '@react-native-picker/picker';
import { View, useColorScheme } from 'react-native';

import { cn } from '../../lib/cn';

export function Picker<T>({
  mode = 'dropdown',
  style,
  dropdownIconColor,
  dropdownIconRippleColor,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RNPicker<T>>) {
  const colorScheme = useColorScheme();

  const colors = {
    root: colorScheme === 'dark' ? '#000000' : '#ffffff',
    foreground: colorScheme === 'dark' ? '#ffffff' : '#000000'
  };

  return (
    <View
      className={cn(
        'ios:shadow-sm ios:shadow-black/5 border-background bg-background rounded-md border',
        className
      )}>
      <RNPicker
        mode={mode}
        style={
          style ?? {
            backgroundColor: colors.root,
            borderRadius: 8,
          }
        }
        dropdownIconColor={dropdownIconColor ?? colors.foreground}
        dropdownIconRippleColor={dropdownIconRippleColor ?? colors.foreground}
        {...props}
      />
    </View>
  );
}

export const PickerItem = RNPicker.Item;
