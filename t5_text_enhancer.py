"""
Professional T5-base Text Enhancement System
Transforms casual or basic text into polished, professional versions
"""

import json
import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from functools import lru_cache
import hashlib
from datetime import datetime

logger = logging.getLogger(__name__)

class EnhancementStyle(Enum):
    PROFESSIONAL = "professional"
    TECHNICAL = "technical"
    EXECUTIVE = "executive"
    BUSINESS_VALUE = "business_value"
    CASUAL = "casual"
    FORMAL = "formal"

class Industry(Enum):
    TECHNOLOGY = "technology"
    FINANCE = "finance"
    HEALTHCARE = "healthcare"
    CONSULTING = "consulting"
    GENERAL = "general"

class Audience(Enum):
    EXECUTIVES = "executives"
    TECHNICAL_TEAMS = "technical"
    BUSINESS_STAKEHOLDERS = "business"
    GENERAL = "general"

class TextEnhancer:
    """
    Professional text enhancement using T5-base model
    """
    
    # Prompt templates for different enhancement styles
    PROMPT_TEMPLATES = {
        EnhancementStyle.PROFESSIONAL: "Rewrite this text to sound more professional and formal: {text}",
        EnhancementStyle.TECHNICAL: "Expand this with technical details and industry terminology: {text}",
        EnhancementStyle.EXECUTIVE: "Transform this into executive summary format: {text}",
        EnhancementStyle.BUSINESS_VALUE: "Rewrite focusing on business value and ROI: {text}",
        EnhancementStyle.CASUAL: "Make this text more casual and approachable: {text}",
        EnhancementStyle.FORMAL: "Rewrite in highly formal business language: {text}"
    }
    
    # Industry-specific enhancement templates
    INDUSTRY_TEMPLATES = {
        Industry.TECHNOLOGY: {
            "prefix": "As a technology professional, enhance this text with proper technical terminology: ",
            "keywords": ["system", "architecture", "implementation", "scalability", "security", "API", "integration"]
        },
        Industry.FINANCE: {
            "prefix": "As a finance professional, enhance this text with financial terminology: ",
            "keywords": ["ROI", "metrics", "compliance", "risk", "performance", "analysis", "portfolio"]
        },
        Industry.HEALTHCARE: {
            "prefix": "As a healthcare professional, enhance this text with medical and healthcare terminology: ",
            "keywords": ["patient", "compliance", "HIPAA", "clinical", "outcomes", "protocol", "diagnosis"]
        },
        Industry.CONSULTING: {
            "prefix": "As a business consultant, enhance this text with consulting terminology: ",
            "keywords": ["strategy", "stakeholder", "deliverables", "framework", "methodology", "engagement"]
        }
    }
    
    def __init__(self, model_instance=None, max_cache_size=1000):
        """
        Initialize the TextEnhancer
        
        Args:
            model_instance: T5 model instance (will get from TaskAnalyzer if None)
            max_cache_size: Maximum number of cached enhancements
        """
        self.model = model_instance
        self.cache_size = max_cache_size
        self._enhancement_cache = {}
        self.metrics = {
            "total_enhancements": 0,
            "cache_hits": 0,
            "average_time": 0
        }
        
    def _get_model(self):
        """Get T5 model instance"""
        if not self.model:
            try:
                from t5_task_analyzer import get_analyzer_instance
                analyzer = get_analyzer_instance()
                self.model = analyzer
            except ImportError:
                logger.error("T5 model not available")
                return None
        return self.model
    
    def _generate_text(self, prompt: str, **kwargs) -> str:
        """Generate text using T5 model"""
        model = self._get_model()
        if not model:
            return self._fallback_enhancement(prompt)
        
        # Set generation parameters - only use parameters supported by TaskAnalyzer
        params = {
            "max_new_tokens": kwargs.get("max_length", 200),
            "num_beams": kwargs.get("num_beams", 4),
            "temperature": kwargs.get("temperature", 0.8)
        }
        # Note: repetition_penalty not supported by TaskAnalyzer._generate_text
        
        try:
            return model._generate_text(prompt, **params)
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return self._fallback_enhancement(prompt)
    
    def _fallback_enhancement(self, prompt: str) -> str:
        """Fallback enhancement when model is not available"""
        # Extract the actual text from various prompt formats
        text = prompt
        
        # Common prompt patterns to remove
        prompt_patterns = [
            r"^Rewrite this text to sound more professional and formal:\s*",
            r"^Expand this with technical details and industry terminology:\s*",
            r"^Transform this into executive summary format:\s*",
            r"^Rewrite focusing on business value and ROI:\s*",
            r"^Make this text more casual and approachable:\s*",
            r"^Rewrite in highly formal business language:\s*",
            r"^As a \w+ professional, enhance this text.*?:\s*",
            r"^Improve the clarity and readability of this text while maintaining its meaning:\s*",
            r"^Text to enhance:\s*"
        ]
        
        # Remove prompt instructions to get actual text
        for pattern in prompt_patterns:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE)
        
        # Also handle multi-line prompts
        if "\n" in text and ":" in text:
            # Take the last part after the last colon
            parts = text.split(":")
            if len(parts) > 1:
                text = parts[-1].strip()
        
        # Professional word replacements
        enhancements = {
            r'\bfix\b': "resolve",
            r'\bbug\b': "defect",
            r'\bmake\b': "implement",
            r'\badd\b': "integrate",
            r'\bdelete\b': "remove",
            r'\bchange\b': "modify",
            r'\bupdate\b': "enhance",
            r'\bquick\b': "efficient",
            r'\bfast\b': "expeditious",
            r'\bslow\b': "performance-impacted",
            r'\bbroken\b': "non-functional",
            r'\bworking on\b': "developing",
            r'\bbuild\b': "construct",
            r'\bimprove\b': "optimize",
            r'\bnew\b': "innovative",
            r'\bold\b': "legacy",
            r'\bsimple\b': "streamlined",
            r'\bhard\b': "complex",
            r'\beasy\b': "intuitive",
            r'\bget\b': "obtain",
            r'\bset\b': "configure",
            r'\brun\b': "execute",
            r'\btest\b': "validate",
            r'\bcheck\b': "verify",
            r'\bfind\b': "identify",
            r'\bshow\b': "display",
            r'\bhide\b': "conceal",
            r'\bstart\b': "initiate",
            r'\bstop\b': "terminate",
            r'\buser\b': "end-user",
            r'\bdata\b': "information",
            r'\bfile\b': "document",
            r'\berror\b': "exception",
            r'\bwebsite\b': "web application",
            r'\bspeed\b': "performance",
            r'\blogin\b': "authentication",
            r'\bpassword\b': "credential",
            r'\bemail\b': "electronic correspondence",
            r'\bdashboard\b': "executive interface",
            r'\breport\b': "analytical summary",
            r'\bfeature\b': "capability",
            r'\bsystem\b': "infrastructure"
        }
        
        result = text
        for pattern, replacement in enhancements.items():
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
        
        # Add professional prefixes based on content
        lower_text = text.lower()
        
        if "authentication" in lower_text or "security" in lower_text or "jwt" in lower_text:
            # Security-related enhancement
            if not result.startswith(("Implement", "Design", "Develop", "Engineer")):
                result = f"Engineer comprehensive {result}"
        elif "performance" in lower_text or "optimize" in lower_text:
            # Performance-related enhancement
            if not result.startswith(("Optimize", "Enhance", "Improve")):
                result = f"Optimize {result}"
        elif "dashboard" in lower_text or "report" in lower_text or "analytics" in lower_text:
            # Analytics-related enhancement
            if not result.startswith(("Design", "Develop", "Create")):
                result = f"Develop strategic {result}"
        elif any(word in lower_text for word in ["fix", "bug", "error", "issue"]):
            # Bug fix enhancement
            if not result.startswith(("Resolve", "Address", "Remediate")):
                result = f"Remediate critical {result}"
        elif "implement" in lower_text or "build" in lower_text or "create" in lower_text:
            # Development enhancement
            if not result.startswith(("Engineer", "Architect", "Construct")):
                result = f"Architect and {result}"
        
        # Ensure proper capitalization
        if result:
            result = result[0].upper() + result[1:]
        
        # Add professional suffix if appropriate
        if len(result) < 100 and not any(ending in result for ending in [".", "!", "?", "functionality", "system", "platform", "solution"]):
            # Add contextual suffix
            if "authentication" in lower_text or "security" in lower_text:
                result += " following industry security best practices and compliance standards"
            elif "performance" in lower_text:
                result += " to achieve optimal system performance and resource utilization"
            elif "dashboard" in lower_text or "interface" in lower_text:
                result += " with focus on user experience and data visualization excellence"
            elif "api" in lower_text or "integration" in lower_text:
                result += " ensuring seamless integration and API compatibility"
            elif "database" in lower_text or "data" in lower_text:
                result += " with emphasis on data integrity and scalability"
            else:
                result += " to meet business requirements and technical specifications"
        
        # Ensure ends with period
        if result and not result[-1] in '.!?':
            result += '.'
        
        return result
    
    @lru_cache(maxsize=128)
    def _get_cache_key(self, text: str, style: str, context: str = "") -> str:
        """Generate cache key for enhancement"""
        content = f"{text}:{style}:{context}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _chunk_text(self, text: str, max_tokens: int = 400) -> List[str]:
        """
        Smart text chunking for long inputs
        Splits on sentence boundaries when possible
        """
        # Rough estimate: 1 token ≈ 4 characters
        max_chars = max_tokens * 4
        
        if len(text) <= max_chars:
            return [text]
        
        # Split on sentence boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= max_chars:
                current_chunk += sentence + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + " "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def make_professional(self, text: str, **kwargs) -> str:
        """
        Transform text to professional tone
        
        Example:
            "fix the login bug" -> "Resolve authentication system vulnerabilities and implement secure login functionality."
        """
        cache_key = self._get_cache_key(text, "professional")
        if cache_key in self._enhancement_cache:
            self.metrics["cache_hits"] += 1
            return self._enhancement_cache[cache_key]
        
        prompt = self.PROMPT_TEMPLATES[EnhancementStyle.PROFESSIONAL].format(text=text)
        enhanced = self._generate_text(prompt, **kwargs)
        
        self._enhancement_cache[cache_key] = enhanced
        self.metrics["total_enhancements"] += 1
        return enhanced
    
    def add_technical_depth(self, text: str, **kwargs) -> str:
        """
        Add technical details and terminology
        
        Example:
            "update user system" -> "Implement comprehensive user management system upgrade including database schema optimization, 
            API endpoint refactoring, and authentication service integration."
        """
        cache_key = self._get_cache_key(text, "technical")
        if cache_key in self._enhancement_cache:
            self.metrics["cache_hits"] += 1
            return self._enhancement_cache[cache_key]
        
        prompt = self.PROMPT_TEMPLATES[EnhancementStyle.TECHNICAL].format(text=text)
        enhanced = self._generate_text(prompt, **kwargs)
        
        self._enhancement_cache[cache_key] = enhanced
        self.metrics["total_enhancements"] += 1
        return enhanced
    
    def make_executive_summary(self, text: str, **kwargs) -> str:
        """
        Transform into executive summary format
        
        Example:
            "working on new features" -> "Strategic initiative to deliver innovative product capabilities, 
            enhancing competitive positioning and driving customer value realization."
        """
        cache_key = self._get_cache_key(text, "executive")
        if cache_key in self._enhancement_cache:
            self.metrics["cache_hits"] += 1
            return self._enhancement_cache[cache_key]
        
        prompt = self.PROMPT_TEMPLATES[EnhancementStyle.EXECUTIVE].format(text=text)
        enhanced = self._generate_text(prompt, **kwargs)
        
        self._enhancement_cache[cache_key] = enhanced
        self.metrics["total_enhancements"] += 1
        return enhanced
    
    def add_business_value(self, text: str, **kwargs) -> str:
        """
        Focus on business value and ROI
        
        Example:
            "improve website speed" -> "Optimize website performance to reduce load times by 50%, 
            improving conversion rates and customer satisfaction while reducing infrastructure costs."
        """
        cache_key = self._get_cache_key(text, "business_value")
        if cache_key in self._enhancement_cache:
            self.metrics["cache_hits"] += 1
            return self._enhancement_cache[cache_key]
        
        prompt = self.PROMPT_TEMPLATES[EnhancementStyle.BUSINESS_VALUE].format(text=text)
        enhanced = self._generate_text(prompt, **kwargs)
        
        self._enhancement_cache[cache_key] = enhanced
        self.metrics["total_enhancements"] += 1
        return enhanced
    
    def adjust_tone(self, text: str, tone: EnhancementStyle, **kwargs) -> str:
        """
        Adjust text tone to specified style
        
        Args:
            text: Input text
            tone: Target tone (PROFESSIONAL, CASUAL, FORMAL, etc.)
        """
        cache_key = self._get_cache_key(text, tone.value)
        if cache_key in self._enhancement_cache:
            self.metrics["cache_hits"] += 1
            return self._enhancement_cache[cache_key]
        
        if tone in self.PROMPT_TEMPLATES:
            prompt = self.PROMPT_TEMPLATES[tone].format(text=text)
        else:
            prompt = f"Rewrite this text in a {tone.value} tone: {text}"
        
        enhanced = self._generate_text(prompt, **kwargs)
        
        self._enhancement_cache[cache_key] = enhanced
        self.metrics["total_enhancements"] += 1
        return enhanced
    
    def enhance_for_industry(self, text: str, industry: Industry, audience: Audience = Audience.GENERAL, **kwargs) -> str:
        """
        Context-aware enhancement based on industry and audience
        
        Args:
            text: Input text
            industry: Target industry context
            audience: Target audience type
        """
        cache_key = self._get_cache_key(text, f"{industry.value}:{audience.value}")
        if cache_key in self._enhancement_cache:
            self.metrics["cache_hits"] += 1
            return self._enhancement_cache[cache_key]
        
        # Build context-aware prompt
        industry_info = self.INDUSTRY_TEMPLATES.get(industry, {
            "prefix": "Enhance this text professionally: ",
            "keywords": []
        })
        
        if audience == Audience.EXECUTIVES:
            prompt = f"{industry_info['prefix']} Make this suitable for executive leadership: {text}"
        elif audience == Audience.TECHNICAL_TEAMS:
            prompt = f"{industry_info['prefix']} Add technical depth for engineering teams: {text}"
        elif audience == Audience.BUSINESS_STAKEHOLDERS:
            prompt = f"{industry_info['prefix']} Focus on business impact and ROI: {text}"
        else:
            prompt = f"{industry_info['prefix']} {text}"
        
        enhanced = self._generate_text(prompt, **kwargs)
        
        self._enhancement_cache[cache_key] = enhanced
        self.metrics["total_enhancements"] += 1
        return enhanced
    
    def batch_enhance(self, texts: List[str], style: EnhancementStyle = EnhancementStyle.PROFESSIONAL, **kwargs) -> List[str]:
        """
        Batch process multiple texts
        
        Args:
            texts: List of texts to enhance
            style: Enhancement style to apply
        
        Returns:
            List of enhanced texts
        """
        # Remove unsupported parameters
        safe_kwargs = {k: v for k, v in kwargs.items() if k != 'repetition_penalty'}
        
        results = []
        for text in texts:
            if style == EnhancementStyle.PROFESSIONAL:
                enhanced = self.make_professional(text, **safe_kwargs)
            elif style == EnhancementStyle.TECHNICAL:
                enhanced = self.add_technical_depth(text, **safe_kwargs)
            elif style == EnhancementStyle.EXECUTIVE:
                enhanced = self.make_executive_summary(text, **safe_kwargs)
            elif style == EnhancementStyle.BUSINESS_VALUE:
                enhanced = self.add_business_value(text, **safe_kwargs)
            else:
                enhanced = self.adjust_tone(text, style, **safe_kwargs)
            
            results.append(enhanced)
        
        return results
    
    def enhance_with_confidence(self, text: str, style: EnhancementStyle = EnhancementStyle.PROFESSIONAL, 
                               num_variants: int = 3, **kwargs) -> Tuple[str, float]:
        """
        Generate multiple variants and select the best with confidence score
        
        Args:
            text: Input text
            style: Enhancement style
            num_variants: Number of variants to generate
        
        Returns:
            Tuple of (best_enhanced_text, confidence_score)
        """
        # Remove unsupported parameters
        safe_kwargs = {k: v for k, v in kwargs.items() if k != 'repetition_penalty'}
        
        variants = []
        
        for i in range(num_variants):
            # Vary temperature for diversity
            safe_kwargs['temperature'] = 0.7 + (i * 0.1)
            
            if style == EnhancementStyle.PROFESSIONAL:
                enhanced = self.make_professional(text, **safe_kwargs)
            elif style == EnhancementStyle.TECHNICAL:
                enhanced = self.add_technical_depth(text, **safe_kwargs)
            else:
                enhanced = self.adjust_tone(text, style, **safe_kwargs)
            
            variants.append(enhanced)
        
        # Simple scoring based on length and professionalism indicators
        scores = []
        for variant in variants:
            score = 0
            # Length score (prefer moderate length)
            ideal_length = len(text) * 1.5
            length_diff = abs(len(variant) - ideal_length)
            score += max(0, 100 - length_diff)
            
            # Professional indicators
            professional_words = ["implement", "enhance", "optimize", "strategic", "comprehensive", "robust"]
            for word in professional_words:
                if word.lower() in variant.lower():
                    score += 10
            
            # Proper capitalization and punctuation
            if variant and variant[0].isupper():
                score += 5
            if variant and variant[-1] in '.!':
                score += 5
            
            scores.append(score)
        
        # Select best variant
        best_idx = scores.index(max(scores))
        confidence = min(100, max(scores) / 2)  # Normalize to 0-100
        
        return variants[best_idx], confidence / 100
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        return {
            "total_enhancements": self.metrics["total_enhancements"],
            "cache_hits": self.metrics["cache_hits"],
            "cache_hit_rate": self.metrics["cache_hits"] / max(1, self.metrics["total_enhancements"]),
            "cache_size": len(self._enhancement_cache)
        }
    
    def clear_cache(self):
        """Clear enhancement cache"""
        self._enhancement_cache.clear()
        logger.info("Enhancement cache cleared")


class EnhancementPipeline:
    """
    Pipeline for combining multiple enhancement steps
    """
    
    def __init__(self, enhancer: TextEnhancer):
        self.enhancer = enhancer
        self.steps = []
    
    def add_step(self, step_name: str, method, **kwargs):
        """Add enhancement step to pipeline"""
        self.steps.append({
            "name": step_name,
            "method": method,
            "kwargs": kwargs
        })
        return self
    
    def process(self, text: str) -> Dict[str, Any]:
        """Process text through pipeline"""
        results = {
            "original": text,
            "steps": [],
            "final": text
        }
        
        current_text = text
        for step in self.steps:
            enhanced = step["method"](current_text, **step["kwargs"])
            results["steps"].append({
                "name": step["name"],
                "output": enhanced
            })
            current_text = enhanced
        
        results["final"] = current_text
        return results


def enhance_text_for_task_manager(text: str, context: Optional[Dict] = None) -> str:
    """
    Main entry point for task manager text enhancement
    
    Args:
        text: Text to enhance
        context: Optional context (task details, priority, etc.)
    
    Returns:
        Enhanced text
    """
    enhancer = TextEnhancer()
    
    # Determine enhancement style based on context
    if context:
        priority = context.get("priority", "").lower()
        category = context.get("category", "").lower()
        
        # High priority items get executive treatment
        if priority in ["high", "critical"]:
            enhanced = enhancer.make_executive_summary(text)
        # Technical categories get technical enhancement
        elif category in ["bug", "feature", "development"]:
            enhanced = enhancer.add_technical_depth(text)
        # Business categories get business value focus
        elif category in ["business", "strategy", "planning"]:
            enhanced = enhancer.add_business_value(text)
        else:
            enhanced = enhancer.make_professional(text)
    else:
        # Default to professional enhancement
        enhanced = enhancer.make_professional(text)
    
    return enhanced


# Example usage and testing
if __name__ == "__main__":
    # Test examples
    test_cases = [
        ("fix the login bug", "professional"),
        ("update user system", "technical"),
        ("working on new features", "executive"),
        ("improve website speed", "business_value"),
        ("Design and implement a secure user authentication system with JWT tokens, password reset functionality, and two-factor authentication support.", "professional")
    ]
    
    enhancer = TextEnhancer()
    
    print("Text Enhancement Examples")
    print("=" * 60)
    
    for text, style_name in test_cases:
        print(f"\nOriginal: {text}")
        print(f"Style: {style_name}")
        
        if style_name == "professional":
            enhanced = enhancer.make_professional(text)
        elif style_name == "technical":
            enhanced = enhancer.add_technical_depth(text)
        elif style_name == "executive":
            enhanced = enhancer.make_executive_summary(text)
        elif style_name == "business_value":
            enhanced = enhancer.add_business_value(text)
        
        print(f"Enhanced: {enhanced}")
        print("-" * 40)
    
    # Test industry-specific enhancement
    print("\nIndustry-Specific Enhancement:")
    text = "build new dashboard"
    for industry in [Industry.TECHNOLOGY, Industry.FINANCE, Industry.HEALTHCARE]:
        enhanced = enhancer.enhance_for_industry(text, industry, Audience.EXECUTIVES)
        print(f"{industry.value}: {enhanced}")
    
    # Show metrics
    print(f"\nMetrics: {enhancer.get_metrics()}")