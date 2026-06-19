import { Form } from "./components/Form";
import { Interview } from "./components/Interview";
import { Result } from "./components/Result";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router"; // Cleaned up useNavigate/useState imports if unused

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Form />} />
        <Route path="/interview/:interviewId" element={<Interview />} />
        <Route path="/result/:interviewId" element={<Result />} />
      </Routes>
      
      {/* Both components were displaying because these lines duplicated your router logic. Wiped them out! */}
      
      <Toaster position="bottom-left" />
    </BrowserRouter>
  );
}