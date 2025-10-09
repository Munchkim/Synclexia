
import { StyleSheet, Dimensions } from 'react-native';
const { width: screenWidth } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: { padding: 16 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 18, textAlign: 'center', marginTop: 16, color: '#666' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },

  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  recapButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 2, backgroundColor: '#f8f9fa', minWidth: 60 },
  recapButtonText: { textAlign: 'center', fontWeight: 'bold' },

  videoContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, position: 'relative' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },

  audioButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 25, gap: 12, backgroundColor: '#111' },
  audioButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  tracingInstructions: { textAlign: 'center', fontSize: 16, marginBottom: 12, color: '#666' },
  tracingContainer: { borderRadius: 12, borderWidth: 2, overflow: 'hidden', backgroundColor: '#fff' },
  canvas: { backgroundColor: '#fff' },

  canvasControls: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#f8f9fa', gap: 10 },
  controlButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  clearButton: { backgroundColor: '#ff6b6b' },
  controlButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  examplesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  exampleCard: { width: (screenWidth - 80) / 2, borderRadius: 12, borderWidth: 2, padding: 12, backgroundColor: '#f8f9fa', alignItems: 'center' },
  exampleImage: { width: 80, height: 80, marginBottom: 8 },
  exampleLabel: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },

  blendingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  blendingButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 2, backgroundColor: '#f8f9fa' },
  blendingText: { fontWeight: 'bold', textAlign: 'center' },

  loadMoreBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 2 },
  loadMoreTxt: { fontWeight: '700' },

  altSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  altBigPhoneme: {
    fontSize: 64,
    textAlign: 'center',
    marginVertical: 6,
    fontWeight: '800',
  },
  altChipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  altChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altChipText: { fontSize: 18, fontWeight: '700' },

  altWordCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  altWordText: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  altDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5, opacity: 0.8 },

  trickyWrapper: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trickyChipsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10,
    justifyContent: 'flex-start',
  },
  trickyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  trickyWord: {
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    color: '#333',
    textTransform: 'lowercase',
  },

  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  expandedTracingContainer: { flex: 1, margin: 20, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  expandedCanvas: { flex: 1, aspectRatio: 1, backgroundColor: '#fff' },
  modalControls: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, gap: 20 },
  modalButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 25, gap: 8 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});



