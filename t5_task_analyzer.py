"""
T5-based Task Analyzer for intelligent task management
Uses Flan-T5-base for better instruction following
"""
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import threading
from functools import lru_cache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for model management
_model = None
_tokenizer = None
_device = None
_model_lock = threading.Lock()
_model_loading = False
_model_load_progress = 0
_model_load_status = ""


class TaskAnalyzer:
    """
    Comprehensive T5-based task analysis system
    Handles summarization, priority classification, categorization, and more
    """
    
    def __init__(self, model_name: str = "google/flan-t5-base", 
                 device: str = "auto",
                 max_length: int = 512,
                 cache_size: int = 128):
        """
        Initialize the TaskAnalyzer
        
        Args:
            model_name: Hugging Face model identifier
            device: Device to run model on ("auto", "cpu", or "cuda")
            max_length: Maximum token length for input
            cache_size: Size of LRU cache for results
        """
        self.model_name = model_name
        self.max_length = max_length
        self.device_type = device
        self.model = None
        self.tokenizer = None
        self.device = None
        
        # Configure cache
        self._configure_cache(cache_size)
        
        # Initialize model
        self._initialize_model()
    
    def _configure_cache(self, cache_size: int):
        """Configure LRU cache for results"""
        # Create cached versions of core methods
        self._cached_generate = lru_cache(maxsize=cache_size)(self._generate_text)
    
    def _initialize_model(self):
        """Initialize T5 model and tokenizer with error handling"""
        global _model, _tokenizer, _device, _model_loading, _model_load_progress, _model_load_status
        
        with _model_lock:
            if _model is not None and _tokenizer is not None:
                self.model = _model
                self.tokenizer = _tokenizer
                self.device = _device
                logger.info("Using existing loaded model")
                return
            
            if _model_loading:
                logger.warning("Model is already being loaded by another instance")
                return
            
            _model_loading = True
            _model_load_progress = 0
            _model_load_status = "Initializing..."
        
        try:
            # Check for required libraries
            try:
                import torch
                from transformers import T5ForConditionalGeneration, T5Tokenizer
            except ImportError as e:
                logger.error(f"Required libraries not installed: {e}")
                _model_load_status = "Error: Missing dependencies"
                raise ImportError("Please install torch and transformers: pip install torch transformers")
            
            _model_load_progress = 20
            _model_load_status = "Detecting device..."
            
            # Device detection
            if self.device_type == "auto":
                self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            else:
                self.device = torch.device(self.device_type)
            
            logger.info(f"Using device: {self.device}")
            
            _model_load_progress = 40
            _model_load_status = f"Loading tokenizer from {self.model_name}..."
            
            # Load tokenizer
            self.tokenizer = T5Tokenizer.from_pretrained(self.model_name)
            
            _model_load_progress = 60
            _model_load_status = f"Loading model from {self.model_name}..."
            
            # Load model with memory optimization
            self.model = T5ForConditionalGeneration.from_pretrained(
                self.model_name,
                torch_dtype=torch.float16 if self.device.type == "cuda" else torch.float32
            ).to(self.device)
            
            # Set to evaluation mode
            self.model.eval()
            
            _model_load_progress = 100
            _model_load_status = "Model loaded successfully"
            
            # Store globally for reuse
            with _model_lock:
                _model = self.model
                _tokenizer = self.tokenizer
                _device = self.device
                _model_loading = False
            
            logger.info(f"Successfully loaded {self.model_name}")
            
        except Exception as e:
            with _model_lock:
                _model_loading = False
                _model_load_status = f"Error: {str(e)}"
                _model_load_progress = 0
            logger.error(f"Failed to load model: {e}")
            raise
    
    def get_model_status(self) -> Dict[str, Any]:
        """Get current model loading status"""
        return {
            'loading': _model_loading,
            'progress': _model_load_progress,
            'status': _model_load_status,
            'loaded': self.model is not None
        }
    
    def _preprocess_text(self, text: str) -> str:
        """Clean and normalize input text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters that might confuse the model
        text = re.sub(r'[^\w\s\-\.\,\!\?\:\;\@\#\$\%\(\)]', '', text)
        return text.strip()
    
    def _chunk_text(self, text: str, max_tokens: int = 450) -> List[str]:
        """
        Split text into chunks that fit within token limits
        Tries to split at sentence boundaries
        """
        if not self.tokenizer:
            return [text[:1000]]  # Fallback if tokenizer not loaded
        
        # Tokenize to check length
        tokens = self.tokenizer.encode(text, return_tensors="pt")
        
        if tokens.shape[1] <= max_tokens:
            return [text]
        
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_tokens = self.tokenizer.encode(sentence, add_special_tokens=False)
            sentence_length = len(sentence_tokens)
            
            if current_length + sentence_length > max_tokens:
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = [sentence]
                    current_length = sentence_length
                else:
                    # Single sentence too long, truncate it
                    chunks.append(sentence[:500])
                    current_chunk = []
                    current_length = 0
            else:
                current_chunk.append(sentence)
                current_length += sentence_length
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def _generate_text(self, prompt: str, max_new_tokens: int = 100,
                      temperature: float = 0.7, num_beams: int = 4) -> str:
        """
        Generate text using T5 model
        
        Args:
            prompt: Input prompt
            max_new_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            num_beams: Number of beams for beam search
        
        Returns:
            Generated text
        """
        if not self.model or not self.tokenizer:
            logger.warning("Model not initialized, using fallback")
            return self._fallback_generation(prompt)
        
        try:
            import torch
            
            # Preprocess prompt
            prompt = self._preprocess_text(prompt)
            
            # Tokenize input
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                max_length=self.max_length,
                truncation=True,
                padding=True
            ).to(self.device)
            
            # Generate with no_grad for efficiency
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    num_beams=num_beams,
                    temperature=temperature,
                    early_stopping=True,
                    do_sample=temperature > 0,
                    top_p=0.9,
                    repetition_penalty=1.2
                )
            
            # Decode output
            generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Validate output
            if not generated_text or len(generated_text) < 3:
                logger.warning("Generated text too short, using fallback")
                return self._fallback_generation(prompt)
            
            return generated_text
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return self._fallback_generation(prompt)
    
    def _fallback_generation(self, prompt: str) -> str:
        """Fallback when model generation fails"""
        if "summarize:" in prompt.lower():
            return "Task requires attention. Please review details."
        elif "priority" in prompt.lower():
            return "medium"
        elif "category" in prompt.lower():
            return "general"
        elif "deadline" in prompt.lower():
            return "No specific deadline found"
        elif "next steps" in prompt.lower():
            return "Review task details and take appropriate action"
        elif "effort" in prompt.lower():
            return "moderate"
        else:
            return "Unable to process request"
    
    def summarize_text(self, text: str, max_length: int = 50) -> str:
        """
        Summarize task description or long text
        
        Args:
            text: Text to summarize
            max_length: Maximum length of summary
        
        Returns:
            Summarized text
        """
        if len(text.split()) < 10:
            return text  # Too short to summarize
        
        prompt = f"summarize: {text}"
        
        # Use cached generation if available
        summary = self._cached_generate(prompt, max_new_tokens=max_length)
        
        # Validate summary
        if summary and len(summary) > 5:
            return summary
        else:
            # Fallback to simple extraction
            words = text.split()[:max_length]
            return ' '.join(words) + ('...' if len(words) == max_length else '')
    
    def classify_priority(self, text: str) -> str:
        """
        Classify task priority based on text content
        
        Args:
            text: Task description
        
        Returns:
            Priority level: "high", "medium", or "low"
        """
        # Check for urgency keywords first
        urgent_keywords = ['urgent', 'asap', 'critical', 'immediately', 'blocking', 
                          'emergency', 'high priority', 'important']
        text_lower = text.lower()
        
        for keyword in urgent_keywords:
            if keyword in text_lower:
                return "high"
        
        # Use T5 for classification
        prompt = f"classify the priority of this task as high, medium, or low: {text}"
        result = self._generate_text(prompt, max_new_tokens=10, temperature=0.3)
        
        # Validate result
        result_lower = result.lower()
        if "high" in result_lower:
            return "high"
        elif "low" in result_lower:
            return "low"
        else:
            return "medium"
    
    def categorize_task(self, text: str) -> str:
        """
        Categorize task into predefined categories
        
        Args:
            text: Task description
        
        Returns:
            Task category
        """
        # Define categories with keywords
        categories = {
            'bug_fix': ['bug', 'fix', 'error', 'issue', 'problem', 'broken'],
            'feature': ['feature', 'add', 'new', 'implement', 'create'],
            'documentation': ['document', 'docs', 'readme', 'guide', 'manual'],
            'testing': ['test', 'qa', 'quality', 'coverage'],
            'refactoring': ['refactor', 'cleanup', 'optimize', 'improve'],
            'deployment': ['deploy', 'release', 'production', 'launch'],
            'meeting': ['meeting', 'discussion', 'sync', 'review'],
            'research': ['research', 'investigate', 'explore', 'analyze']
        }
        
        text_lower = text.lower()
        
        # Check keywords first
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return category
        
        # Use T5 for categorization
        prompt = f"categorize this task as bug_fix, feature, documentation, testing, refactoring, deployment, meeting, or research: {text}"
        result = self._generate_text(prompt, max_new_tokens=20, temperature=0.3)
        
        # Validate result
        result_lower = result.lower()
        for category in categories.keys():
            if category in result_lower or category.replace('_', ' ') in result_lower:
                return category
        
        return "general"
    
    def extract_deadlines(self, text: str) -> Optional[str]:
        """
        Extract deadline information from text
        
        Args:
            text: Task description
        
        Returns:
            Extracted deadline or None
        """
        import re
        from datetime import datetime, timedelta
        
        # Common deadline patterns
        patterns = [
            r'due (?:on |by |)(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)',
            r'deadline[:\s]+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)',
            r'by (\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)',
            r'(today|tomorrow|next week|this week|monday|tuesday|wednesday|thursday|friday)',
            r'(\d{1,2})\s*(days?|weeks?|months?)\s*(?:from now)?'
        ]
        
        text_lower = text.lower()
        
        # Check patterns
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                deadline_text = match.group(1)
                
                # Convert relative dates
                today = datetime.now()
                if deadline_text == 'today':
                    return today.strftime('%Y-%m-%d')
                elif deadline_text == 'tomorrow':
                    return (today + timedelta(days=1)).strftime('%Y-%m-%d')
                elif deadline_text == 'next week':
                    return (today + timedelta(weeks=1)).strftime('%Y-%m-%d')
                elif deadline_text == 'this week':
                    days_until_friday = (4 - today.weekday()) % 7
                    return (today + timedelta(days=days_until_friday)).strftime('%Y-%m-%d')
                else:
                    return deadline_text
        
        # Use T5 for extraction
        prompt = f"extract the deadline date from this text: {text}"
        result = self._generate_text(prompt, max_new_tokens=20, temperature=0.3)
        
        if result and result != "No deadline found":
            return result
        
        return None
    
    def suggest_next_steps(self, text: str) -> List[str]:
        """
        Generate actionable next steps for a task
        
        Args:
            text: Task description
        
        Returns:
            List of suggested next steps
        """
        prompt = f"list 3 actionable next steps for this task: {text}"
        result = self._generate_text(prompt, max_new_tokens=150, temperature=0.7)
        
        # Parse result into list
        steps = []
        
        # Try to extract numbered or bulleted items
        lines = result.split('\n')
        for line in lines:
            line = line.strip()
            # Remove numbering or bullets
            line = re.sub(r'^[\d\.\-\*\•]\s*', '', line)
            if line and len(line) > 5:
                steps.append(line)
        
        # Ensure we have at least some steps
        if not steps:
            # Generate default steps based on category
            category = self.categorize_task(text)
            if category == 'bug_fix':
                steps = [
                    "Reproduce the issue",
                    "Identify root cause",
                    "Implement and test fix"
                ]
            elif category == 'feature':
                steps = [
                    "Define requirements",
                    "Design implementation",
                    "Develop and test feature"
                ]
            else:
                steps = [
                    "Review task requirements",
                    "Plan implementation approach",
                    "Execute and validate"
                ]
        
        return steps[:5]  # Limit to 5 steps
    
    def estimate_effort(self, text: str) -> str:
        """
        Estimate effort/complexity for a task
        
        Args:
            text: Task description
        
        Returns:
            Effort level: "low", "moderate", or "high"
        """
        # Check for complexity indicators
        complexity_indicators = {
            'high': ['complex', 'difficult', 'challenging', 'extensive', 'large', 
                    'major', 'significant', 'multiple', 'several days', 'weeks'],
            'low': ['simple', 'easy', 'quick', 'minor', 'small', 'trivial', 
                   'straightforward', 'few hours', 'hour or two'],
            'moderate': ['medium', 'moderate', 'standard', 'typical', 'normal', 
                        'few hours', 'half day', 'day or two']
        }
        
        text_lower = text.lower()
        
        # Check indicators
        for level, indicators in complexity_indicators.items():
            for indicator in indicators:
                if indicator in text_lower:
                    return level
        
        # Use T5 for estimation
        prompt = f"estimate the effort level (low, moderate, or high) for this task: {text}"
        result = self._generate_text(prompt, max_new_tokens=10, temperature=0.3)
        
        # Validate result
        result_lower = result.lower()
        if "high" in result_lower:
            return "high"
        elif "low" in result_lower:
            return "low"
        else:
            return "moderate"
    
    def analyze_task(self, text: str) -> Dict[str, Any]:
        """
        Comprehensive task analysis
        
        Args:
            text: Task description
        
        Returns:
            Dictionary with all analysis results
        """
        # Ensure model is loaded
        if not self.model:
            self._initialize_model()
        
        # Preprocess text
        text = self._preprocess_text(text)
        
        # Perform all analyses
        results = {
            'original_text': text,
            'summary': self.summarize_text(text),
            'priority': self.classify_priority(text),
            'category': self.categorize_task(text),
            'deadline': self.extract_deadlines(text),
            'effort_estimate': self.estimate_effort(text),
            'next_steps': self.suggest_next_steps(text),
            'analyzed_at': datetime.now().isoformat()
        }
        
        return results
    
    def batch_analyze(self, tasks: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze multiple tasks in batch
        
        Args:
            tasks: List of task descriptions
        
        Returns:
            List of analysis results
        """
        results = []
        for i, task in enumerate(tasks):
            logger.info(f"Analyzing task {i+1}/{len(tasks)}")
            results.append(self.analyze_task(task))
        return results


# Convenience functions for direct use
def get_analyzer_instance() -> TaskAnalyzer:
    """Get or create a singleton TaskAnalyzer instance"""
    global _analyzer_instance
    if '_analyzer_instance' not in globals():
        _analyzer_instance = TaskAnalyzer()
    return _analyzer_instance


def analyze_task_text(text: str) -> Dict[str, Any]:
    """Convenience function to analyze a single task"""
    analyzer = get_analyzer_instance()
    return analyzer.analyze_task(text)


def get_task_summary(text: str) -> str:
    """Convenience function to get task summary"""
    analyzer = get_analyzer_instance()
    return analyzer.summarize_text(text)


def get_task_priority(text: str) -> str:
    """Convenience function to get task priority"""
    analyzer = get_analyzer_instance()
    return analyzer.classify_priority(text)