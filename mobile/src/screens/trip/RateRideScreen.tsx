import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, ratingsApi, type PendingRatingPerson } from '../../api';
import { Avatar, Button, ErrorBanner, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RateRide'>;

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Great ride!'];
const TAGS = ['On time', 'Safe driving', 'Clean car', 'Friendly', 'Good music', 'Smooth route'];

export function RateRideScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const [people, setPeople] = useState<PendingRatingPerson[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['On time']);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ratingsApi
      .getPendingRatings(rideId)
      .then(setPeople)
      .catch((err) => setError(getApiError(err, 'Could not load people to rate.')))
      .finally(() => setLoading(false));
  }, [rideId]);

  const currentPerson = people[currentIdx];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async () => {
    if (!currentPerson) {
      navigation.navigate('MainTabs', { screen: 'HomeTab' });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const reviewParts = [...selectedTags];
      if (note.trim()) reviewParts.push(note.trim());
      await ratingsApi.submitRating({
        ride_id: rideId,
        rated_user_id: currentPerson.user_id,
        score,
        review: reviewParts.join(' · ').slice(0, 300) || undefined,
      });
      if (currentIdx + 1 < people.length) {
        setCurrentIdx(currentIdx + 1);
        setScore(5);
        setSelectedTags(['On time']);
        setNote('');
      } else {
        Alert.alert('Thank you!', 'Your rating helps keep NED Transport Hub safe and reliable.');
        navigation.navigate('MainTabs', { screen: 'HomeTab' });
      }
    } catch (err) {
      setError(getApiError(err, 'Could not submit rating.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar
          title="Rate ride"
          onBack={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        />
        <View style={styles.content}>
          <ErrorBanner message={error} />

          {loading ? (
            <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
          ) : !currentPerson ? (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 32 }}>
              <Icon name="CircleCheck" size={44} color={colors.success} />
              <Text style={styles.title}>All ratings submitted!</Text>
              <Text style={styles.sub}>You have already rated everyone on this ride.</Text>
            </View>
          ) : (
            <>
              <Avatar name={currentPerson.name} size={74} />
              <Text style={styles.title}>How was your ride with {currentPerson.name}?</Text>
              {people.length > 1 ? (
                <Text style={styles.sub}>
                  Person {currentIdx + 1} of {people.length}
                </Text>
              ) : null}

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TouchableOpacity key={i} onPress={() => setScore(i)}>
                    <Icon
                      name="Star"
                      size={38}
                      color={i <= score ? colors.accentBright : colors.line}
                      fill={i <= score ? colors.accent : 'none'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.scoreLabel}>{LABELS[score]}</Text>

              <View style={styles.tagsWrap}>
                {TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={[styles.tagBtn, active && styles.tagActive]}
                    >
                      <Text style={[styles.tagText, active && { color: colors.brand }]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={`Add a note for ${currentPerson.name} (optional)`}
                placeholderTextColor={colors.ink3}
                multiline
                style={styles.textArea}
              />
            </>
          )}
        </View>
      </Screen>

      <Footer>
        <Button loading={submitting} onPress={handleSubmit}>
          {currentPerson ? 'Submit Rating' : 'Back to Home'}
        </Button>
        <Text style={styles.anonNote}>Your rating helps build trust across NED</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
          style={{ alignItems: 'center', paddingVertical: 4 }}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, alignItems: 'center', gap: 14, paddingTop: 10 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.ink2, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  scoreLabel: { fontSize: 15, fontWeight: '700', color: colors.brand },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  tagBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tagActive: { borderColor: colors.brand, backgroundColor: colors.brandSubtle },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  textArea: {
    width: '100%',
    height: 100,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.ink,
  },
  anonNote: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
  skipText: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
});
