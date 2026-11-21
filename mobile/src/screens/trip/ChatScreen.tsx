import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { chatApi, getApiError, tokenStorage, type MessageRead } from '../../api';
import { Avatar, Badge, ErrorBanner, Icon } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radii } from '../../theme';
import { formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
  const { bookingId, peerName = 'Ride Chat', subtitle = 'Confirmed booking' } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<MessageRead[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<MessageRead>>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const hist = await chatApi.getMessages(bookingId);
        if (active) setMessages(hist);
      } catch (err) {
        if (active) setError(getApiError(err, 'Could not load messages.'));
      }

      const token = await tokenStorage.getAccessToken();
      if (!token || !active) return;

      const ws = new WebSocket(chatApi.getWebSocketUrl(bookingId, token));
      ws.onopen = () => active && setConnected(true);
      ws.onclose = () => active && setConnected(false);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'message' && data.id) {
            setMessages((prev) =>
              prev.some((m) => m.id === data.id) ? prev : [...prev, data as MessageRead],
            );
          }
        } catch {
          // ignore
        }
      };
      wsRef.current = ws;
    })();

    const poll = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      chatApi
        .getMessages(bookingId)
        .then((hist) => {
          if (active) setMessages(hist);
        })
        .catch(() => null);
    }, 4000);

    return () => {
      active = false;
      clearInterval(poll);
      wsRef.current?.close();
    };
  }, [bookingId]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setText('');
    setError(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content: trimmed }));
      return;
    }
    try {
      const saved = await chatApi.sendMessage(bookingId, trimmed);
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
    } catch (err) {
      setError(getApiError(err, 'Could not send message.'));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Avatar name={peerName} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.peerName} numberOfLines={1}>
            {peerName}
          </Text>
          <Text style={[styles.status, { color: connected ? colors.success : colors.ink3 }]}>
            {connected ? `Live · ${subtitle}` : subtitle}
          </Text>
        </View>
        <Badge tone={connected ? 'success' : 'info'}>{connected ? 'Live' : 'Chat'}</Badge>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {error ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.empty}>No messages yet. Say Assalam o Alaikum!</Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: colors.white }]}>
                    {item.content}
                  </Text>
                  <Text
                    style={[
                      styles.bubbleTime,
                      mine && { color: 'rgba(255,255,255,0.65)' },
                    ]}
                  >
                    {formatTime(item.sent_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composerWrap}>
          <View style={styles.quickRow}>
            {['On my way', '5 min late', 'I am here'].map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => sendMessage(q)}
                style={styles.quickPill}
              >
                <Text style={styles.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${peerName}`}
              placeholderTextColor={colors.ink3}
              style={styles.input}
              onSubmitEditing={() => sendMessage(text)}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={() => sendMessage(text)} style={styles.sendBtn}>
              <Icon name="Send" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: { padding: 4 },
  peerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  status: { fontSize: 12, marginTop: 1 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.ink3, marginTop: 40, fontSize: 14 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: colors.ink },
  bubbleTime: { fontSize: 10, color: colors.ink3, marginTop: 4, textAlign: 'right' },
  composerWrap: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: 12,
    gap: 10,
  },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickPill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  quickText: { fontSize: 12, fontWeight: '600', color: colors.ink2 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.ink,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
