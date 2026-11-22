import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, type IconName } from './ui';
import { colors, radii, shadows } from '../theme';

type DialogTone = 'info' | 'success' | 'warning' | 'danger';

interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onPress?: () => void;
}

interface DialogConfig {
  title: string;
  message: string;
  tone?: DialogTone;
  icon?: IconName;
  actions: DialogAction[];
}

interface ToastConfig {
  title: string;
  message?: string;
  tone?: DialogTone;
}

interface DialogContextValue {
  showAlert: (opts: {
    title: string;
    message: string;
    tone?: DialogTone;
    buttonLabel?: string;
    onClose?: () => void;
  }) => void;
  showConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }) => void;
  showOptions: (opts: {
    title: string;
    message?: string;
    options: { label: string; onPress: () => void }[];
  }) => void;
  showToast: (toast: ToastConfig) => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

const TONE_META: Record<DialogTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.brandSubtle, fg: colors.brand, icon: 'BadgeCheck' },
  success: { bg: colors.successSubtle, fg: colors.success, icon: 'CircleCheck' },
  warning: { bg: colors.warningSubtle, fg: colors.warning, icon: 'TriangleAlert' },
  danger: { bg: colors.dangerSubtle, fg: colors.danger, icon: 'CircleAlert' },
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [toast, setToast] = useState<ToastConfig | null>(null);

  const closeDialog = useCallback(() => setDialog(null), []);

  const showToast = useCallback((cfg: ToastConfig) => {
    setToast(cfg);
    setTimeout(() => {
      setToast((curr) => (curr === cfg ? null : curr));
    }, 3600);
  }, []);

  const showAlert = useCallback(
    ({
      title,
      message,
      tone = 'success',
      buttonLabel = 'Got it',
      onClose,
    }: {
      title: string;
      message: string;
      tone?: DialogTone;
      buttonLabel?: string;
      onClose?: () => void;
    }) => {
      setDialog({
        title,
        message,
        tone,
        actions: [
          {
            label: buttonLabel,
            variant: tone === 'danger' ? 'danger' : 'primary',
            onPress: onClose,
          },
        ],
      });
    },
    [],
  );

  const showConfirm = useCallback(
    ({
      title,
      message,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      destructive = false,
      onConfirm,
    }: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
      onConfirm: () => void;
    }) => {
      setDialog({
        title,
        message,
        tone: destructive ? 'danger' : 'warning',
        actions: [
          { label: cancelLabel, variant: 'secondary' },
          {
            label: confirmLabel,
            variant: destructive ? 'danger' : 'primary',
            onPress: onConfirm,
          },
        ],
      });
    },
    [],
  );

  const showOptions = useCallback(
    ({
      title,
      message = '',
      options,
    }: {
      title: string;
      message?: string;
      options: { label: string; onPress: () => void }[];
    }) => {
      setDialog({
        title,
        message,
        tone: 'info',
        icon: 'Upload',
        actions: [
          ...options.map((o) => ({ label: o.label, variant: 'primary' as const, onPress: o.onPress })),
          { label: 'Cancel', variant: 'secondary' },
        ],
      });
    },
    [],
  );

  const meta = TONE_META[dialog?.tone ?? 'info'];
  const toastMeta = TONE_META[toast?.tone ?? 'success'];

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showOptions, showToast }}>
      {children}

      {toast ? (
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.toastOverlay}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setToast(null)}
            style={styles.toastCard}
          >
            <View style={[styles.toastIcon, { backgroundColor: toastMeta.bg }]}>
              <Icon name={toastMeta.icon} size={18} color={toastMeta.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toastTitle}>{toast.title}</Text>
              {toast.message ? <Text style={styles.toastMsg}>{toast.message}</Text> : null}
            </View>
          </TouchableOpacity>
        </SafeAreaView>
      ) : null}

      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
              <Icon name={dialog?.icon ?? meta.icon} size={28} color={meta.fg} />
            </View>
            <Text style={styles.modalTitle}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.modalMsg}>{dialog.message}</Text> : null}

            <View
              style={[
                styles.actionsWrap,
                dialog && dialog.actions.length === 2 ? styles.actionsRow : null,
              ]}
            >
              {dialog?.actions.map((act) => (
                <View
                  key={act.label}
                  style={dialog.actions.length === 2 ? { flex: 1 } : { width: '100%' }}
                >
                  <Button
                    small
                    variant={act.variant ?? 'primary'}
                    onPress={() => {
                      closeDialog();
                      act.onPress?.();
                    }}
                  >
                    {act.label}
                  </Button>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,29,72,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...shadows.sheet,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  modalMsg: {
    fontSize: 13,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 19,
  },
  actionsWrap: {
    width: '100%',
    gap: 8,
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toastOverlay: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    ...shadows.sheet,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  toastMsg: { fontSize: 12, color: colors.ink2, marginTop: 1 },
});
