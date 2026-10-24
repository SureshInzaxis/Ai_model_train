import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import PdfUpload from './pages/Pdf/PdfUpload'
import PdfList from './pages/Pdf/PdfList'
import QuestionList from './pages/Questions/QuestionList'
import QuestionView from './pages/Questions/QuestionView'
import ReviewQueue from './pages/Review/ReviewQueue'
import ImportForm from './pages/Import/ImportForm'
import ExportForm from './pages/Export/ExportForm'
import CorrectedList from './pages/Corrected/CorrectedList'

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pdfs/upload" element={<PdfUpload />} />
        <Route path="/pdfs" element={<PdfList />} />
        <Route path="/questions" element={<QuestionList />} />
        <Route path="/questions/:id" element={<QuestionView />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="/import" element={<ImportForm />} />
        <Route path="/export" element={<ExportForm />} />
        <Route path="/corrected" element={<CorrectedList />} />
      </Routes>
    </Layout>
  )
}

export default App
