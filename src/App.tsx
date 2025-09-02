// src/App.tsx - CORRECTED VERSION

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button, Card, Spinner, Alert, Table, Navbar, Tabs, Tab } from 'react-bootstrap';
import './App.css';

// --- Type Definitions ---
interface User {
  name: string;
  email: string;
  age: number;
  category: 'kids' | 'teens' | 'adults';
}
interface StoryResult {
  caption: string;
  story_text: string;
  audio_base64: string;
}
interface ArchivedStory {
  id: number;
  input_type: string;
  input_name: string;
  age_group: string;
  language: string;
  timestamp: string;
}
type AgeGroup = 'Kids (3-7)' | 'Teenagers (13-18)' | 'Adults (18+)';

const API_URL = 'http://localhost:8000';


// ===================================================================
// 1. App Component (Controller)
// ===================================================================
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const login = (userData: User) => { setUser(userData); };
  const logout = () => { setUser(null); };

  if (!user) {
    return <LoginPage onLogin={login} />;
  }
  return <StorytellerPage user={user} onLogout={logout} />;
};
export default App;


// ===================================================================
// 2. LoginPage Component
// ===================================================================
interface LoginPageProps {
  onLogin: (user: User) => void;
}
const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = parseInt(age, 10);
    if (!name || !email || !age || isNaN(ageNum) || ageNum < 3) {
      setError('Please fill all fields with valid data (age 3+).');
      return;
    }
    setError('');

    let category: 'kids' | 'teens' | 'adults';
    if (ageNum <= 12) category = 'kids';
    else if (ageNum <= 18) category = 'teens';
    else category = 'adults';

    onLogin({ name, email, age: ageNum, category });
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Card style={{ width: '400px' }} className="p-4 shadow-lg">
        <h2 className="text-center mb-4">Welcome to AI Storyteller</h2>
        <Form onSubmit={handleSubmit}>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3" controlId="formName"><Form.Label>Your Name</Form.Label><Form.Control type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} /></Form.Group>
          <Form.Group className="mb-3" controlId="formEmail"><Form.Label>Email address</Form.Label><Form.Control type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} /></Form.Group>
          <Form.Group className="mb-3" controlId="formAge"><Form.Label>Your Age</Form.Label><Form.Control type="number" placeholder="Enter your age" value={age} onChange={(e) => setAge(e.target.value)} /></Form.Group>
          <div className="d-grid"><Button variant="primary" type="submit" size="lg">Start Creating</Button></div>
        </Form>
      </Card>
    </Container>
  );
};


// ===================================================================
// 3. StorytellerPage Component
// ===================================================================
interface StorytellerPageProps {
  user: User;
  onLogout: () => void;
}
const StorytellerPage: React.FC<StorytellerPageProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('image');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('Kids (3-7)');
  const [language, setLanguage] = useState<string>('en');
  const [storyResult, setStoryResult] = useState<StoryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [archive, setArchive] = useState<ArchivedStory[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const themeClass = `theme-${user.category}`;

  const fetchArchive = async () => {
    try {
        const response = await axios.get<ArchivedStory[]>(`${API_URL}/stories`);
        setArchive(response.data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
        console.error("Failed to fetch archive:", err);
    }
  };

  useEffect(() => { fetchArchive(); }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    }).catch(err => {
        console.error("Error accessing microphone:", err);
        setError("Could not access microphone. Please check browser permissions.");
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
    if (activeTab === 'image' && imageFile) formData.append('image', imageFile);
    else if (activeTab === 'text' && textPrompt.trim()) formData.append('text_prompt', textPrompt);
    else if (activeTab === 'voice' && audioBlob) formData.append('audio', audioBlob, 'user_recording.webm');
    else {
        setError('Please provide an input for the selected method.');
        setIsLoading(false);
        return;
    }
    try {
        const response = await axios.post<StoryResult>(`${API_URL}/generate-story-multimodal`, formData);
        setStoryResult(response.data);
        await fetchArchive();
    } catch (err: any) {
        setError(err.response?.data?.detail || 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className={themeClass}>
      <Navbar expand="lg" className="app-navbar shadow-sm"><Container><Navbar.Brand>🎨 AI Storyteller</Navbar.Brand><Navbar.Toggle /><Navbar.Collapse className="justify-content-end"><Navbar.Text className="me-3">Welcome, <strong>{user.name}</strong>!</Navbar.Text><Button variant="outline-secondary" size="sm" onClick={onLogout}>Logout</Button></Navbar.Collapse></Container></Navbar>
      <Container fluid className="my-5 px-4 px-md-5">
        <Row>
          <Col lg={5} className="mb-4"><Card className="p-4 h-100 shadow-lg"><h2 className="text-center mb-3">Create Your Story</h2><Form onSubmit={handleSubmit}>
            {/* THIS IS THE CORRECTED LINE */}
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'image')} className="mb-3 nav-fill">
              <Tab eventKey="image" title="📷 By Image"><Form.Group controlId="formFile" className="mt-3"><Form.Label>Upload a Picture</Form.Label><Form.Control type="file" accept="image/*" onChange={handleImageChange} />{previewImage && <img src={previewImage} alt="Preview" className="img-fluid rounded mt-3" />}</Form.Group></Tab>
              <Tab eventKey="text" title="✍️ By Text"><Form.Group controlId="formText" className="mt-3"><Form.Label>Enter a Story Idea</Form.Label><Form.Control as="textarea" rows={4} placeholder="e.g., A brave knight finds a lost dragon..." value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} /></Form.Group></Tab>
              <Tab eventKey="voice" title="🎤 By Voice"><div className="mt-3 text-center"><p>Record your story idea out loud.</p><Button variant={isRecording ? "danger" : "success"} onClick={isRecording ? stopRecording : startRecording}>{isRecording ? '■ Stop Recording' : '● Start Recording'}</Button>{audioBlob && !isRecording && <audio controls src={URL.createObjectURL(audioBlob)} className="w-100 mt-3" />}</div></Tab>
            </Tabs>
            <hr />
            <Form.Group className="mb-3"><Form.Label><strong>Select Audience</strong></Form.Label><div className="d-flex justify-content-around">{(['Kids (3-7)', 'Teenagers (13-18)', 'Adults (18+)'] as AgeGroup[]).map(group => (<Form.Check type="radio" key={group} id={`age-${group}`} label={group} name="ageGroup" value={group} checked={ageGroup === group} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)} />))}</div></Form.Group>
            <Form.Group className="mb-4"><Form.Label><strong>Select Language</strong></Form.Label><Form.Select value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option><option value="hi">Hindi</option></Form.Select></Form.Group>
            <div className="d-grid"><Button variant="primary" type="submit" disabled={isLoading} size="lg">{isLoading ? <><Spinner as="span" size="sm" /> Generating...</> : '✨ Generate Story'}</Button></div>
          </Form></Card></Col>
          <Col lg={7}>{isLoading && <div className="text-center p-5"><Spinner animation="border" style={{width: '4rem', height: '4rem'}} /><p className="mt-3">The AI is thinking...</p></div>}{error && <Alert variant="danger">{error}</Alert>}{storyResult && (<Card className="p-4 shadow-lg"><Card.Title as="h2">{storyResult.caption}</Card.Title><Card.Text as="div" className="story-text">{storyResult.story_text.split('\n').map((p, i) => <p key={i}>{p}</p>)}</Card.Text><audio controls src={`data:audio/mp3;base64,${storyResult.audio_base64}`} className="w-100 mt-3">Your browser does not support the audio element.</audio></Card>)}{!isLoading && !storyResult && <div className="text-center p-5 d-flex align-items-center justify-content-center h-100"><p className="text-muted">Your generated story will appear here.</p></div>}</Col>
        </Row>
        <Row className="mt-5">
            <Col><h2 className="mb-3">📖 Story Archive</h2><Card className="p-3 shadow-lg"><Table striped bordered hover responsive><thead><tr><th>Timestamp</th><th>Input Type</th><th>Input</th><th>Audience</th><th>Language</th></tr></thead><tbody>{archive.map(story => (<tr key={story.id}><td>{new Date(story.timestamp).toLocaleString()}</td><td>{story.input_type}</td><td>{story.input_name}</td><td>{story.age_group}</td><td>{story.language}</td></tr>))}</tbody></Table></Card></Col>
        </Row>
      </Container>
    </div>
  );
};