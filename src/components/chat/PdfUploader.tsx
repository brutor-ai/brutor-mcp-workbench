/*
 * Copyright 2025 Martin Bergljung
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker that matches the installed version
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use the CDN version that matches the bundled version (5.4.54)
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.js';
  
  console.log('PDF.js worker configured for bundled version 5.4.54');
}

interface PdfUploaderProps {
  onPdfProcessed: (filename: string, extractedText: string) => void;
  disabled?: boolean;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({
  onPdfProcessed,
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const extractPdfTextFromBlob = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const pdf = await pdfjsLib.getDocument({ 
      data: uint8Array,
      verbosity: 0,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        
        const pageText = textContent.items
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item.str) return item.str;
            if (item.text) return item.text;
            return '';
          })
          .filter(text => text.trim().length > 0)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
        }
      } catch (pageError) {
        console.warn(`Error processing page ${pageNum}:`, pageError);
        fullText += `\n--- Page ${pageNum} (Error reading page) ---\n`;
      }
    }
    
    return fullText.trim();
  };

  const processPdfFile = async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a PDF file');
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log(`Processing PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      
      const extractedText = await extractPdfTextFromBlob(file);
      
      if (extractedText.trim()) {
        onPdfProcessed(file.name, extractedText);
        console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
      } else {
        onPdfProcessed(file.name, `[PDF "${file.name}" processed but no text content was extracted - this may be an image-only PDF]`);
        console.warn('No text extracted - may be image-only PDF');
      }
      
    } catch (error) {
      console.error('PDF processing error:', error);
      alert(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processPdfFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      processPdfFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
        className="hidden"
        id="pdf-upload"
      />
      
      <label
        htmlFor="pdf-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          inline-flex items-center space-x-1 px-2 py-1 border border-gray-300 rounded-md
          cursor-pointer transition-colors text-xs
          ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
          ${dragOver ? 'bg-blue-50 border-blue-300' : ''}
        `}
        title="Upload PDF file"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Upload className="w-3 h-3" />
            <span>PDF</span>
          </>
        )}
      </label>
      
      {dragOver && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-75 flex items-center justify-center rounded-md z-10">
          <div className="text-blue-700 font-medium text-xs">Drop PDF</div>
        </div>
      )}
    </div>
  );
};