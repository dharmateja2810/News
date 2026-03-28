import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../utils/hooks';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface ExplainerData {
  headline: string;
  whyItMatters: string;
  content: string;
  tier: number;
}

interface ExplainerViewProps {
  articleId: string;
  onClose: () => void;
}

export const ExplainerView: React.FC<ExplainerViewProps> = ({ articleId, onClose }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExplainerData | null>(null);

  useEffect(() => {
    // In a real app we fetch from our backend using `articleId`
    // const url = `http://localhost:3000/api/explainer/article/${articleId}`;
    // For this prototype, if it fails, we fall back to a mock, or we can actually call our backend!
    // Automatically routing based on platform/device
    const isEmulator = false; // Set to true if testing on Android Emulator
    const hostIp = '10.60.232.185'; // Inferred local machine IP
    
    const apiUrl = Platform.OS === 'web' 
        ? `http://localhost:3000/api/explainer/article/${articleId}`
        : isEmulator 
            ? `http://10.0.2.2:3000/api/explainer/article/${articleId}`
            : `http://${hostIp}:3000/api/explainer/article/${articleId}`;

    fetch(apiUrl)
      .then(res => res.json())
      .then(json => {
         if (json.success) {
           setData(json.explainer);
         } else {
            console.error(json.message);
         }
      })
      .catch(err => {
         console.warn("Using mock explainer since backend fetch failed", err);
         setData({
             headline: "The RBA held rates again. Here's what they're actually waiting for.",
             whyItMatters: "Mortgage costs stay elevated for longer. The RBA's next move depends on data landing over the next 6 weeks.",
             tier: 1,
             content: "The Reserve Bank of Australia has left the cash rate on hold at 4.10%, citing inflation that is still running above target. On the surface, this might look like a non-decision. But it tells you a lot about where the RBA thinks the economy is sitting — and where it's heading.\n\nHere's the thing. Inflation in Australia has been falling. But falling and fallen are two very different things... \n\nWhat to watch: the next CPI print and the Q1 jobs numbers."
         });
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  const isDark = theme.colors.background === '#121212' || theme.colors.background === '#000000';
  return (
    <Modal transparent visible={true} animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.container}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={[theme.colors.surface, 'transparent']}
          style={styles.headerGradient}
        >
          <TouchableOpacity onPress={onClose} style={[styles.closeIcon, { alignSelf: 'flex-end', padding: 8 }]}>
            <Ionicons 
              name="close-circle" 
              size={36} 
              color={theme.colors.text} 
            />
          </TouchableOpacity>
        </LinearGradient>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Synthesizing Double Click...
            </Text>
          </View>
        ) : data ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View>
              <Text style={[styles.tierTag, { color: theme.colors.primary }]}>
                DOUBLE CLICK • TIER {data.tier}
              </Text>
              
              <Text style={[styles.headline, { color: theme.colors.text }]}>
                {data.headline}
              </Text>
              
              <View style={[styles.whyBox, { backgroundColor: theme.colors.backgroundSecondary }]}>
                 <Text style={[styles.whyTitle, { color: theme.colors.accent }]}>Why it matters</Text>
                 <Text style={[styles.whyText, { color: theme.colors.text }]}>{data.whyItMatters}</Text>
              </View>

              <View style={styles.divider} />
              
              {data.content.split('\n\n').map((paragraph, index) => {
                 const isQuestion = paragraph.trim().endsWith('?') || paragraph.includes('But here\'s the thing') || paragraph.startsWith('So why does this matter');
                 const isWatch = paragraph.toLowerCase().includes('what to watch');
                 return (
                   <Text 
                      key={index} 
                      style={[
                        styles.paragraph, 
                        { color: theme.colors.textSecondary },
                        isQuestion && { color: theme.colors.text, fontWeight: '700', fontSize: 17 },
                        isWatch && { color: theme.colors.primary, fontWeight: '600' }
                      ]}
                   >
                     {paragraph.trim()}
                   </Text>
                 );
              })}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={{ color: theme.colors.text }}>Failed to load Explainer.</Text>
          </View>
        )}
      </View>
    </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerGradient: {
    height: 120,
    width: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 10,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 24,
    paddingTop: 50,
  },
  closeIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  tierTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: 24,
  },
  whyBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6', // theme accents would go here
  },
  whyTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  whyText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.2)',
    marginBottom: 24,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 18,
  },
});
