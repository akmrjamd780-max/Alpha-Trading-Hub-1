import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/Header";
import { Card } from "@/components/Card";
import { useColors, useRadius } from "@/hooks/useColors";
import { addEntry, closeEntry, deleteEntry, listEntries, type JournalEntry } from "@/lib/journal";
import { useMarket } from "@/context/MarketContext";
import { getQuote } from "@/lib/marketData";

export default function JournalScreen() {
  const colors = useColors();
  const radius = useRadius();
  const { symbol } = useMarket();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [entry, setEntry] = useState("");
  const [size, setSize] = useState("0.1");
  const [strategy, setStrategy] = useState("");
  const [notes, setNotes] = useState("");

  const quoteQ = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => getQuote(symbol),
    refetchInterval: 30_000,
  });

  const reload = async () => setEntries(await listEntries());
  useEffect(() => {
    reload();
  }, []);

  const open = entries.filter((e) => e.status === "OPEN");
  const closed = entries.filter((e) => e.status === "CLOSED");

  const livePrice = quoteQ.data?.price ?? 0;
  const openPnl = open.reduce((acc, e) => {
    if (!livePrice) return acc;
    const dir = e.side === "LONG" ? 1 : -1;
    return acc + (livePrice - e.entry) * dir * e.size;
  }, 0);
  const closedPnl = closed.reduce((acc, e) => acc + (e.pnl ?? 0), 0);
  const wins = closed.filter((e) => (e.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  async function handleAdd() {
    const e = parseFloat(entry);
    const s = parseFloat(size);
    if (!isFinite(e) || e <= 0) {
      Alert.alert("Invalid entry price");
      return;
    }
    if (!isFinite(s) || s <= 0) {
      Alert.alert("Invalid size");
      return;
    }
    await addEntry({ symbol, side, entry: e, size: s, strategy, notes });
    setEntry("");
    setSize("0.1");
    setStrategy("");
    setNotes("");
    setShowAdd(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await reload();
  }

  async function handleClose(e: JournalEntry) {
    if (!livePrice) {
      Alert.alert("Live price not available");
      return;
    }
    await closeEntry(e.id, livePrice);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await reload();
  }

  async function handleDelete(e: JournalEntry) {
    if (Platform.OS === "web") {
      await deleteEntry(e.id);
      await reload();
    } else {
      Alert.alert("Delete trade?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEntry(e.id);
            await reload();
          },
        },
      ]);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Trade Journal"
        subtitle={`${symbol} · ${open.length} open · ${closed.length} closed`}
        right={
          <Pressable
            onPress={() => setShowAdd(true)}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.gold, borderRadius: radius - 4 },
            ]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SummaryCard label="Open P/L" value={`${openPnl >= 0 ? "+" : ""}$${openPnl.toFixed(2)}`} tone={openPnl >= 0 ? "bull" : "bear"} />
          <SummaryCard label="Closed P/L" value={`${closedPnl >= 0 ? "+" : ""}$${closedPnl.toFixed(2)}`} tone={closedPnl >= 0 ? "bull" : "bear"} />
          <SummaryCard label="Win Rate" value={`${winRate.toFixed(0)}%`} tone={winRate >= 50 ? "bull" : "bear"} />
        </View>

        {open.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.section, { color: colors.foreground }]}>Open Positions</Text>
            {open.map((e) => {
              const dir = e.side === "LONG" ? 1 : -1;
              const pnl = (livePrice - e.entry) * dir * e.size;
              return (
                <Card key={e.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={[
                        styles.sideTag,
                        { backgroundColor: e.side === "LONG" ? colors.bullish : colors.bearish, borderRadius: 5 },
                      ]}
                    >
                      <Text style={styles.sideTagText}>{e.side}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                        {e.symbol} · {e.size}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                        Entry ${e.entry.toFixed(2)} · {e.strategy || "—"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          color: pnl >= 0 ? colors.bullish : colors.bearish,
                          fontFamily: "Inter_700Bold",
                          fontSize: 14,
                        }}
                      >
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>
                        Live ${livePrice.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  {e.notes ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                      {e.notes}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Pressable
                      onPress={() => handleClose(e)}
                      style={[
                        styles.actionBtn,
                        { backgroundColor: colors.gold, borderRadius: radius - 6 },
                      ]}
                    >
                      <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                        Close @ ${livePrice.toFixed(2)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(e)}
                      style={[
                        styles.actionBtn,
                        { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, borderRadius: radius - 6 },
                      ]}
                    >
                      <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {closed.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.section, { color: colors.foreground }]}>History</Text>
            {closed.map((e) => (
              <Card key={e.id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={[
                      styles.sideTag,
                      { backgroundColor: e.side === "LONG" ? colors.bullish : colors.bearish, borderRadius: 5 },
                    ]}
                  >
                    <Text style={styles.sideTagText}>{e.side}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {e.symbol} · {e.size}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                      ${e.entry.toFixed(2)} → ${e.exit?.toFixed(2)} · {e.strategy || "—"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: (e.pnl ?? 0) >= 0 ? colors.bullish : colors.bearish,
                      fontFamily: "Inter_700Bold",
                      fontSize: 14,
                    }}
                  >
                    {(e.pnl ?? 0) >= 0 ? "+" : ""}${(e.pnl ?? 0).toFixed(2)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {entries.length === 0 && (
          <Card>
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <Feather name="book-open" size={36} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                No trades yet
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", paddingHorizontal: 30 }}>
                Tap the + button above to log your first XAUUSD trade. P/L tracks live against the current spot price.
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={[styles.modalRoot, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Trade</Text>
              <Pressable onPress={() => setShowAdd(false)} style={{ marginLeft: "auto" }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {(["LONG", "SHORT"] as const).map((s) => {
                const active = s === side;
                const c = s === "LONG" ? colors.bullish : colors.bearish;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSide(s)}
                    style={[
                      styles.sideBtn,
                      {
                        backgroundColor: active ? c : "transparent",
                        borderColor: c,
                        borderRadius: radius - 6,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? "#fff" : c,
                        fontFamily: "Inter_700Bold",
                        fontSize: 13,
                        letterSpacing: 0.5,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Field label="Symbol" value={symbol} editable={false} />
            <Field
              label="Entry Price"
              value={entry}
              onChangeText={setEntry}
              placeholder={livePrice ? livePrice.toFixed(2) : "0.00"}
              keyboardType="decimal-pad"
            />
            <Field
              label="Size (lots)"
              value={size}
              onChangeText={setSize}
              placeholder="0.1"
              keyboardType="decimal-pad"
            />
            <Field
              label="Strategy (optional)"
              value={strategy}
              onChangeText={setStrategy}
              placeholder="e.g. ICT Silver Bullet"
            />
            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Setup, conditions, etc."
              multiline
            />

            <Pressable
              onPress={handleAdd}
              style={[
                styles.submitBtn,
                { backgroundColor: colors.gold, borderRadius: radius - 4 },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 14, letterSpacing: 0.3 }}>
                Add Trade
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "bull" | "bear" }) {
  const colors = useColors();
  const radius = useRadius();
  const c = tone === "bull" ? colors.bullish : colors.bearish;
  return (
    <View
      style={[
        styles.summary,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius - 4 },
      ]}
    >
      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: c, fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
}) {
  const colors = useColors();
  const radius = useRadius();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.cardElevated,
            borderColor: colors.border,
            borderRadius: radius - 6,
            fontFamily: "Inter_500Medium",
            opacity: editable ? 1 : 0.6,
            minHeight: multiline ? 70 : undefined,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  summary: { flex: 1, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  section: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginTop: 6 },
  sideTag: { paddingHorizontal: 8, paddingVertical: 3 },
  sideTagText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  actionBtn: {
    flex: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalCard: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 30,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sideBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
});
