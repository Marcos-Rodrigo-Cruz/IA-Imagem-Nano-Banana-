import { GoogleGenAI, Modality } from "@google/genai";

// Ensure the API key is available
if (!process.env.API_KEY) {
  const body = document.querySelector('body');
  if(body) {
    body.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; color: #333;">
      <h1>Erro de Configuração</h1>
      <p>A aplicação não está configurada corretamente. A chave da API (API_KEY) está faltando.</p>
    </div>`;
  }
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- STATE ---
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
let currentMode = 'create';
let activeCreateFunction = 'free';
let activeEditFunction = 'add-remove';
let currentAspectRatio: AspectRatio = '1:1';
let uploadedImageBase64: string | null = null;
let uploadedImageMimeType: string | null = null;
let uploadedImage1Base64: string | null = null;
let uploadedImage1MimeType: string | null = null;
let uploadedImage2Base64: string | null = null;
let uploadedImage2MimeType: string | null = null;
let generatedImageBase64: string | null = null;
let generatedImageMimeType: string = 'image/png';

// --- DOM ELEMENTS (initialized in DOMContentLoaded) ---
let promptInput: HTMLTextAreaElement;
let generateBtn: HTMLButtonElement;
let btnText: HTMLSpanElement;
let spinner: HTMLDivElement;
let loadingContainer: HTMLDivElement;
let resultPlaceholder: HTMLDivElement;
let imageContainer: HTMLDivElement;
let generatedImage: HTMLImageElement;
let mobileModal: HTMLDivElement;
let modalImage: HTMLImageElement;
let uploadArea: HTMLDivElement;
let twoImagesSection: HTMLDivElement;
let editFunctions: HTMLDivElement;
let createFunctions: HTMLDivElement;
let aspectRatioSection: HTMLDivElement;
let imagePreview: HTMLImageElement;
let imagePreview1: HTMLImageElement;
let imagePreview2: HTMLImageElement;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // Query all DOM elements
  promptInput = document.getElementById('prompt') as HTMLTextAreaElement;
  generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
  btnText = generateBtn.querySelector('.btn-text') as HTMLSpanElement;
  spinner = generateBtn.querySelector('.spinner') as HTMLDivElement;
  loadingContainer = document.getElementById('loadingContainer') as HTMLDivElement;
  resultPlaceholder = document.getElementById('resultPlaceholder') as HTMLDivElement;
  imageContainer = document.getElementById('imageContainer') as HTMLDivElement;
  generatedImage = document.getElementById('generatedImage') as HTMLImageElement;
  mobileModal = document.getElementById('mobileModal') as HTMLDivElement;
  modalImage = document.getElementById('modalImage') as HTMLImageElement;
  uploadArea = document.getElementById('uploadArea') as HTMLDivElement;
  twoImagesSection = document.getElementById('twoImagesSection') as HTMLDivElement;
  editFunctions = document.getElementById('editFunctions') as HTMLDivElement;
  createFunctions = document.getElementById('createFunctions') as HTMLDivElement;
  aspectRatioSection = document.getElementById('aspectRatioSection') as HTMLDivElement;
  imagePreview = document.getElementById('imagePreview') as HTMLImageElement;
  imagePreview1 = document.getElementById('imagePreview1') as HTMLImageElement;
  imagePreview2 = document.getElementById('imagePreview2') as HTMLImageElement;

  // --- EVENT LISTENERS ---
  
  // Mode selection
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode((btn as HTMLElement).dataset.mode));
  });

  // Function card selection
  document.querySelectorAll('#createFunctions .function-card').forEach(card => {
    card.addEventListener('click', () => selectCreateFunction((card as HTMLElement).dataset.function));
  });
  document.querySelectorAll('#editFunctions .function-card').forEach(card => {
    card.addEventListener('click', () => selectEditFunction(
      (card as HTMLElement).dataset.function, 
      (card as HTMLElement).dataset.requiresTwo === 'true'
    ));
  });

  // Aspect Ratio selection
  document.querySelectorAll('#aspectRatioSection .function-card').forEach(card => {
    card.addEventListener('click', () => {
        const ratio = (card as HTMLElement).dataset.ratio;
        if (ratio === '1:1' || ratio === '16:9' || ratio === '9:16' || ratio === '4:3' || ratio === '3:4') {
            selectAspectRatio(ratio as AspectRatio);
        }
    });
  });

  // Image Uploads
  const setupUploadListener = (areaId: string, inputId: string, previewId: string, imageIndex?: number) => {
    document.getElementById(areaId)?.addEventListener('click', () => document.getElementById(inputId)?.click());
    document.getElementById(inputId)?.addEventListener('change', (event) => handleImageUpload(
      event.target as HTMLInputElement, 
      previewId, 
      imageIndex
    ));
  };
  setupUploadListener('uploadArea', 'imageUpload', 'imagePreview');
  setupUploadListener('uploadAreaDual1', 'imageUpload1', 'imagePreview1', 1);
  setupUploadListener('uploadAreaDual2', 'imageUpload2', 'imagePreview2', 2);
  
  // Main Actions
  generateBtn.addEventListener('click', generateImage);
  document.getElementById('backBtn')?.addEventListener('click', backToEditFunctions);
  document.getElementById('editCurrentBtn')?.addEventListener('click', editCurrentImage);
  document.getElementById('downloadBtn')?.addEventListener('click', downloadImage);

  // Modal Actions
  document.getElementById('modalEditBtn')?.addEventListener('click', editCurrentImage);
  document.getElementById('modalDownloadBtn')?.addEventListener('click', downloadImage);
  document.getElementById('modalNewImageBtn')?.addEventListener('click', newImageFromModal);

  // Initial UI state
  switchMode('create');
});

// --- UI LOGIC ---

function setLoading(isLoading: boolean) {
  if (isLoading) {
    spinner.style.display = 'block';
    btnText.textContent = 'Gerando...';
    generateBtn.disabled = true;
    loadingContainer.style.display = 'flex';
    resultPlaceholder.style.display = 'none';
    imageContainer.style.display = 'none';
  } else {
    spinner.style.display = 'none';
    btnText.textContent = '🚀 Gerar Imagem';
    generateBtn.disabled = false;
    loadingContainer.style.display = 'none';
  }
}

function switchMode(mode?: string) {
  if (!mode) return;
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
  });
  
  if (mode === 'create') {
    createFunctions.style.display = 'block';
    aspectRatioSection.style.display = 'block';
    editFunctions.style.display = 'none';
    uploadArea.style.display = 'none';
    twoImagesSection.style.display = 'none';
  } else { // edit mode
    createFunctions.style.display = 'none';
    aspectRatioSection.style.display = 'none';
    selectEditFunction(activeEditFunction, activeEditFunction === 'compose');
  }
}

function selectCreateFunction(func?: string) {
    if (!func) return;
    activeCreateFunction = func;
    document.querySelectorAll('#createFunctions .function-card').forEach(card => {
        card.classList.toggle('active', (card as HTMLElement).dataset.function === func);
    });
}

function selectAspectRatio(ratio: AspectRatio) {
    currentAspectRatio = ratio;
    document.querySelectorAll('#aspectRatioSection .function-card').forEach(card => {
        card.classList.toggle('active', (card as HTMLElement).dataset.ratio === ratio);
    });
}

function selectEditFunction(func?: string, requiresTwo?: boolean) {
    if (!func) return;
    activeEditFunction = func;
    document.querySelectorAll('#editFunctions .function-card').forEach(card => {
        card.classList.toggle('active', (card as HTMLElement).dataset.function === func);
    });

    if (currentMode !== 'edit') return;

    if (requiresTwo) {
        uploadArea.style.display = 'none';
        twoImagesSection.style.display = 'block';
        editFunctions.style.display = 'none';
    } else {
        uploadArea.style.display = 'block';
        twoImagesSection.style.display = 'none';
        editFunctions.style.display = 'block';
    }
}

function backToEditFunctions() {
  twoImagesSection.style.display = 'none';
  editFunctions.style.display = 'block';
}

function showResult(base64Image: string, mimeType: string) {
  generatedImageBase64 = base64Image;
  generatedImageMimeType = mimeType;
  const imageUrl = `data:${mimeType};base64,${base64Image}`;
  
  generatedImage.src = imageUrl;
  imageContainer.style.display = 'block';
  resultPlaceholder.style.display = 'none';

  modalImage.src = imageUrl;
  if (window.innerWidth < 768) {
    mobileModal.style.display = 'flex';
  }
}

function resetUI() {
    promptInput.value = '';
    
    [imagePreview, imagePreview1, imagePreview2].forEach(p => {
        if(p) {
            p.src = '';
            p.style.display = 'none';
        }
    });
    
    uploadedImageBase64 = null;
    uploadedImage1Base64 = null;
    uploadedImage2Base64 = null;
    
    resultPlaceholder.style.display = 'flex';
    imageContainer.style.display = 'none';
    mobileModal.style.display = 'none';
    
    switchMode('create');
    selectCreateFunction('free');
    selectAspectRatio('1:1');
}

// --- CORE LOGIC & ACTIONS ---

function handleImageUpload(input: HTMLInputElement, previewId: string, imageIndex?: number) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result as string;
    const base64String = dataUrl.split(',')[1];
    const mimeType = file.type;
    const preview = document.getElementById(previewId) as HTMLImageElement;
    preview.src = dataUrl;
    preview.style.display = 'block';

    if (imageIndex === 1) {
      uploadedImage1Base64 = base64String;
      uploadedImage1MimeType = mimeType;
    } else if (imageIndex === 2) {
      uploadedImage2Base64 = base64String;
      uploadedImage2MimeType = mimeType;
    } else {
      uploadedImageBase64 = base64String;
      uploadedImageMimeType = mimeType;
    }
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function generateImage() {
  const prompt = promptInput.value.trim();
  if (currentMode === 'create' && !prompt) {
    alert('Por favor, descreva sua ideia.');
    return;
  }
  
  setLoading(true);
  try {
    if (currentMode === 'create') {
      await handleCreateImage(prompt);
    } else {
      await handleEditImage(prompt);
    }
  } catch (error) {
    console.error('Error generating image:', error);
    alert(`Ocorreu um erro ao gerar a imagem: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setLoading(false);
  }
}

function editCurrentImage() {
  if (!generatedImageBase64) return;
  
  switchMode('edit');
  selectEditFunction('add-remove');

  uploadedImageBase64 = generatedImageBase64;
  uploadedImageMimeType = generatedImageMimeType;
  imagePreview.src = `data:${uploadedImageMimeType};base64,${uploadedImageBase64}`;
  imagePreview.style.display = 'block';
  
  mobileModal.style.display = 'none';
  window.scrollTo(0, 0);
}

function downloadImage() {
  if (!generatedImageBase64) return;
  const link = document.createElement('a');
  link.href = `data:${generatedImageMimeType};base64,${generatedImageBase64}`;
  const extension = generatedImageMimeType.split('/')[1] || 'png';
  link.download = `ai-image-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function newImageFromModal() {
  resetUI();
}

// --- API CALLS ---

async function handleCreateImage(prompt: string) {
  let finalPrompt = prompt;
  switch(activeCreateFunction) {
    case 'sticker': finalPrompt = `a high-quality vector sticker of ${prompt}, with a bold white outline, on a plain white background`; break;
    case 'text': finalPrompt = `a professional logo featuring the text "${prompt}", minimalist design, vector art, high resolution`; break;
    case 'comic': finalPrompt = `a panel from a graphic novel depicting ${prompt}, comic book art style, vibrant colors, dynamic action lines`; break;
  }
  
  const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: finalPrompt,
      config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: currentAspectRatio },
  });

  const image = response.generatedImages?.[0];
  if (image?.image?.imageBytes) {
    showResult(image.image.imageBytes, 'image/png');
  } else {
    throw new Error('A API não retornou uma imagem.');
  }
}

async function handleEditImage(prompt: string) {
  const isCompose = activeEditFunction === 'compose';
  if (isCompose && (!uploadedImage1Base64 || !uploadedImage2Base64)) {
    throw new Error('Por favor, selecione duas imagens para unir.');
  }
  if (!isCompose && !uploadedImageBase64) {
    throw new Error('Por favor, selecione uma imagem para editar.');
  }

  const parts: any[] = [];
  if (isCompose) {
    parts.push({ inlineData: { data: uploadedImage1Base64!, mimeType: uploadedImage1MimeType! }});
    parts.push({ inlineData: { data: uploadedImage2Base64!, mimeType: uploadedImage2MimeType! }});
  } else {
    parts.push({ inlineData: { data: uploadedImageBase64!, mimeType: uploadedImageMimeType! }});
  }
  
  if (prompt) {
    parts.push({ text: prompt });
  } else {
    parts.push({text: 'Faça a edição solicitada na imagem.'});
  }
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: { parts: parts },
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  });
  
  const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (imagePart?.inlineData) {
    showResult(imagePart.inlineData.data, imagePart.inlineData.mimeType);
  } else {
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    throw new Error(`A edição falhou. Resposta da IA: ${textPart || 'Nenhuma imagem retornada.'}`);
  }
}