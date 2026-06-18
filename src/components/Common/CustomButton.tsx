import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
  testID?: string;
}

export const CustomButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  isLoading = false,
  loading = false,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  testID,
}) => {
  const busy = isLoading || loading;

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        variant === 'secondary' ? styles.btnSecondary : styles.btnPrimary,
        (disabled || isLoading) && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      accessible
      accessibilityLabel={accessibilityLabel || title}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'secondary' ? '#7B2CBF' : '#FFFFFF'} size="small" />
      ) : (
        <Text style={[styles.btnText, variant === 'secondary' && styles.textSecondary]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 8,
  },
  btnPrimary: {
    backgroundColor: '#7B2CBF', // Drexdel Signature Purple
  },
  btnSecondary: {
    backgroundColor: '#F5ECFF',
    borderWidth: 1.5,
    borderColor: '#7B2CBF',
  },
  btnDisabled: {
    backgroundColor: '#CED4DA',
    borderColor: '#CED4DA',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  textSecondary: {
    color: '#7B2CBF',
  },
});
