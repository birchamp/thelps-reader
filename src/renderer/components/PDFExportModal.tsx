import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { resourceManager } from '../services/ResourceManager';
import { parseUsfm, extractChapters } from '../utils/usfmParser';

// Register fonts (optional, but good for better rendering)
// For now we'll use standard fonts to avoid loading issues, 
// but in a real app we might want to register a font that supports more characters.

const styles = StyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 65,
    paddingHorizontal: 35,
    fontFamily: 'Times-Roman',
  },
  header: {
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    color: 'grey',
    fontFamily: 'Times-Roman',
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
    fontFamily: 'Times-Roman',
  },
  chapterTitle: {
    fontSize: 18,
    marginTop: 15,
    marginBottom: 10,
    fontWeight: 'bold',
    fontFamily: 'Times-Roman',
  },
  text: {
    fontSize: 10,
    lineHeight: 1.5,
    textAlign: 'justify',
    fontFamily: 'Times-Roman',
  },
  verseNum: {
    fontSize: 6,
    verticalAlign: 'super',
    color: 'grey',
    fontFamily: 'Times-Roman',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 12,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
    fontFamily: 'Times-Roman',
  },
  viewer: {
    width: '100%',
    height: '100%',
  },
});

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBook: string; // Filename e.g. 43-JHN.usfm
}

export const PDFExportModal = ({ isOpen, onClose, currentBook }: PDFExportModalProps) => {
  const [selectedTranslation, setSelectedTranslation] = useState<'ULT' | 'BSB'>('ULT');
  const [paperSize, setPaperSize] = useState<'A4' | 'LETTER'>('A4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getBookName = (filename: string) => filename.split('/').pop()?.replace('.usfm', '').replace(/^\d+-/, '') || filename;

  const handleExport = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // 1. Fetch content
      let owner = 'unfoldingWord';
      let repo = 'en_ult';
      let adjustedFilename = currentBook;
      
      const baseFilename = currentBook.split('/').pop() || currentBook;

      if (selectedTranslation === 'BSB') {
          owner = 'Worldview';
          repo = 'en_bsb';
          adjustedFilename = `en_bsb/${baseFilename}`;
      } else {
          adjustedFilename = `en_ult/${baseFilename}`;
      }
      
      const content = await resourceManager.getBookContent(owner, repo, adjustedFilename);
      const json = parseUsfm(content);
      const chapters = extractChapters(json);

      // 2. Generate PDF Document
      const MyDocument = (
        <Document>
          <Page size={paperSize} style={styles.page}>
            <Text style={styles.header} fixed>
              {getBookName(currentBook)} - {selectedTranslation}
            </Text>
            
            <Text style={styles.title}>{getBookName(currentBook)}</Text>

            {chapters.map((chapter) => (
              <View key={chapter.chapter}>
                <Text style={styles.chapterTitle}>Chapter {chapter.chapter}</Text>
                <Text style={styles.text}>
                  {chapter.verses.map((verse) => (
                    <Text key={verse.verse}>
                       <Text style={styles.verseNum}>{verse.verse} </Text>
                       <Text>{verse.text} </Text>
                    </Text>
                  ))}
                </Text>
              </View>
            ))}

            <Text 
              style={styles.pageNumber} 
              render={({ pageNumber, totalPages }) => (
                `${pageNumber} / ${totalPages}`
              )} 
              fixed 
            />
          </Page>
        </Document>
      );

      // 3. Create Blob and Download
      const blob = await pdf(MyDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getBookName(currentBook)}_${selectedTranslation}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Export to PDF</h2>
        
        <div className="form-group">
          <label>Translation:</label>
          <select 
            value={selectedTranslation} 
            onChange={e => setSelectedTranslation(e.target.value as 'ULT' | 'BSB')}
          >
            <option value="ULT">ULT (UnfoldingWord Literal Text)</option>
            <option value="BSB">BSB (Berean Study Bible)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Paper Size:</label>
          <select 
            value={paperSize} 
            onChange={e => setPaperSize(e.target.value as 'A4' | 'LETTER')}
          >
            <option value="A4">A4</option>
            <option value="LETTER">Letter</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={isGenerating}>Cancel</button>
          <button onClick={handleExport} disabled={isGenerating} className="primary-btn">
            {isGenerating ? 'Generating...' : 'Export'}
          </button>
        </div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          width: 400px;
          max-width: 90%;
        }
        .form-group {
          margin-bottom: 1.5rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
        }
        .form-group select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }
        .modal-actions button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .primary-btn {
          background: #007bff;
          color: white;
        }
        .primary-btn:disabled {
          background: #ccc;
        }
        .error-message {
          color: red;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
};
