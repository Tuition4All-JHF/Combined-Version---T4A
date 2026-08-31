import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';

interface Tutor {
    id: number;
    user: string;
    bio: string;
    rating: number;
    subjects: { id: number; name: string }[];
}

export default function TutorListScreen() {
    const [tutors, setTutors] = useState<Tutor[]>([]);
    const navigation = useNavigation();

    useEffect(() => {
        apiClient.get('tutors/')
            .then(r => setTutors(r.data))
            .catch(err => console.warn(err));
    }, []);

    const renderItem = ({ item }: { item: Tutor }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TutorDetail', { tutorId: item.id })}
        >
            <Text style={styles.name}>{item.user}</Text>
            <Text style={styles.sub}>{item.subjects.map(s => s.name).join(', ')}</Text>
            <Text style={styles.rating}>⭐ {item.rating}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList data={tutors} renderItem={renderItem} keyExtractor={i => i.id.toString()} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 12 },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    name: { fontSize: 18, fontWeight: '600', color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    rating: { marginTop: 6, color: colors.accent },
});
