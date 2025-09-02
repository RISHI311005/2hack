import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button, Card, Spinner, Alert, Table, Navbar, Tabs, Tab } from 'react-bootstrap';
import { useUser } from './context/UserContext';

// --- Type Definitions (same as before) ---
interface StoryResult { caption: string; story_text: string; audio_base64: string; }
interface ArchivedStory { id: number; input_type: string; input_name: string; age_group: string; language: string; timestamp: string; }
type AgeGroup = 'Kids (3-7)' | 'Teenagers (13-18)' | 'Adults (18+)';

const API_URL = 'http://localhost:8000';

export const StorytellerPage: React.FC = () => {
  const { user, logout } = useUser();
  
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState<string>('image'); // image, text, or voice
  
  // Input states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  
  // Story state (same as before)
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('Kids (3-7)');
  const [language, setLanguage] = useState<string>('en');
  const [storyResult, setStoryResult] = useState<StoryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [archive, setArchive] = useState<ArchivedStory[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // --- HANDLERS ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStoryResult(null);

    const formData = new FormData();
    formData.append('age_group', ageGroup);
    formData.append('language_code', language);

    // Append data based on the active tab
    if (activeTab === 'image' && imageFile) {
        formData.append('image', imageFile);
    } else if (activeTab === 'text' && textPrompt) {
        formData.append('text_prompt', textPrompt);
    } else if (activeTab === 'voice' && audioBlob) {
        formData.append('audio', audioBlob, 'user_recording.webm');
    } else {
        setError('Please provide an input for the selected tab.');
        setIsLoading(false);
        return;
    }

    try {
        const response = await axios.post<StoryResult>(`${API_URL}/generate-story-multimodal`, formData);
        setStoryResult(response.data);
        fetchArchive();
    } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to generate story.');
    } finally {
        setIsLoading(false);
    }
  };

  const fetchArchive = async () => { /* ... same as before ... */ };
  useEffect(() => { fetchArchive(); }, []);
  
  const themeClass = user ? `theme-${user.category}` : 'theme-adults';

  return (
    <>
      <Navbar /* ... same as before ... */ />
      <Container className={`my-5 ${themeClass}`}>
        <div className="text-center mb-4">
          <h1 className="display-4">Create Your Story</h1>
        </div>
        <Row>
          {/* --- INPUT COLUMN --- */}
          <Col md={5}>
            <Card className="p-4">
              <Form onSubmit={handleSubmit}>
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'image')} className="mb-3">
                  {/* Image Tab */}
                  <Tab eventKey="image" title="📷 Image">
                    <Form.Group controlId="formFile" className="mt-3">
                      <Form.Label>Upload an Image</Form.Label>
                      <Form.Control type="file" accept="image/*" onChange={handleImageChange} />
                    </Form.Group>
                    {previewImage && <img src={previewImage} alt="Preview" className="img-fluid rounded mt-3" />}
                  </Tab>
                  {/* Text Tab */}
                  <Tab eventKey="text" title="✍️ Text">
                    <Form.Group controlId="formText" className="mt-3">
                      <Form.Label>Enter a Story Idea</Form.Label>
                      <Form.Control as="textarea" rows={4} value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} />
                    </Form.Group>
                  </Tab>
                  {/* Voice Tab */}
                  <Tab eventKey="voice" title="🎤 Voice">
                    <div className="mt-3 text-center">
                      <p>Record your story idea.</p>
                      <Button variant={isRecording ? "danger" : "success"} onClick={isRecording ? stopRecording : startRecording}>
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                      </Button>
                      {audioBlob && <audio controls src={URL.createObjectURL(audioBlob)} className="w-100 mt-3" />}
                    </div>
                  </Tab>
                </Tabs>

                {/* --- Common settings for all inputs --- */}
                <hr />
                <Form.Group className="mb-3"> {/* ... Age Group Radios (same as before) ... */} </Form.Group>
                <Form.Group className="mb-4"> {/* ... Language Select (same as before) ... */} </Form.Group>
                <div className="d-grid">
                  <Button variant="primary" type="submit" disabled={isLoading}>
                    {isLoading ? <Spinner as="span" size="sm" /> : '✨ Generate Story'}
                  </Button>
                </div>
              </Form>
            </Card>
          </Col>

          {/* --- OUTPUT COLUMN (No changes needed) --- */}
          <Col md={7}> {/* ... Your existing output column JSX ... */} </Col>
        </Row>

        {/* --- STORY ARCHIVE (Slight update for new columns) --- */}
        <Row className="mt-5">
            <Col>
                <h2 className="mb-3">📖 Story Archive</h2>
                {/* ... The rest of the archive component ... */}
                {/* Change the table headers to: Timestamp, Input Type, Input, Age Group, Language */}
            </Col>
        </Row>
      </Container>
    </>
  );
};