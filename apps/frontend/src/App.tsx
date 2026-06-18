import { useState } from "react";
import { Form } from "./components/Form";
import { Interview } from "./components/Interview";
import { Result } from "./components/Result";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router";

export function App() {
  const [page, setPage] = useState<"form" | "interview" | "result">("form");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Form />}/>
        <Route path="/interview/:id" element={<Interview />}/>
        <Route path="/result/:id" element={<Result />}/>
      </Routes>
      {page === "form" && <Form />}
      {page === "interview" && <Interview />}
      {page === "result" && <Result />}
      <Toaster position="bottom-left" />
    </BrowserRouter>
  );
}
