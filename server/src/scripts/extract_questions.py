import sys, os, json, re, pdfplumber

def is_two_column(page):
    width = page.width
    mid = width / 2.0
    words = page.extract_words()
    if not words or len(words) < 20:
        return False
    left_words = [w for w in words if w['x0'] < (mid - 10)]
    right_words = [w for w in words if w['x0'] > (mid + 10)]
    return len(left_words) > 25 and len(right_words) > 25

def words_to_lines(words):
    lines = []
    for w in sorted(words, key=lambda x: (x['top'], x['x0'])):
        placed = False
        for line in lines:
            if abs(line['top'] - w['top']) <= 3.5:
                line['words'].append(w)
                line['top'] = (line['top'] + w['top']) / 2.0
                placed = True
                break
        if not placed:
            lines.append({'top': w['top'], 'words': [w]})
    
    result = []
    for line in sorted(lines, key=lambda l: l['top']):
        sw = sorted(line['words'], key=lambda w: w['x0'])
        result.append(' '.join([w['text'] for w in sw]))
    return '\n'.join(result)

def extract_page_text(page):
    words = page.extract_words()
    if not words:
        return ''
    if is_two_column(page):
        mid = page.width / 2.0
        left_words = [w for w in words if w['x0'] < mid]
        right_words = [w for w in words if w['x0'] >= mid]
        left_text = words_to_lines(left_words)
        right_text = words_to_lines(right_words)
        return left_text + '\n' + right_text
    else:
        return words_to_lines(words)

def parse_questions_from_pdf(pdf_path):
    all_questions = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            page_num = page_idx + 1
            page_text = extract_page_text(page)
            lines = page_text.split('\n')
            
            raw_blocks = []
            curr_block = None
            
            for line in lines:
                clean = line.strip()
                if not clean:
                    continue
                
                m = re.match(r'^(?:Q\s*\.?\s*)?(\d{1,4})\s*[\.\)]\s*(?:\(([a-dA-D])\)\s*[:\.]?\s*)?(.*)', clean)
                is_decimal = bool(re.match(r'^\d+\.\d+', clean))
                is_math_fragment = bool(re.match(r'^\d+\s*[-+=/<>~]', clean))
                
                is_valid_header = False
                if m and not is_decimal and not is_math_fragment:
                    q_num = m.group(1)
                    ans_key = m.group(2)
                    rest_text = (m.group(3) or '').strip()
                    if int(q_num) > 0:
                        if ans_key or len(rest_text) >= 10:
                            is_valid_header = True
                
                if is_valid_header:
                    if curr_block:
                        raw_blocks.append(curr_block)
                    curr_block = {
                        'question_number': m.group(1),
                        'answer_key': m.group(2).upper() if m.group(2) else None,
                        'first_line_rest': m.group(3) or '',
                        'lines': [line],
                        'page_number': page_num
                    }
                elif curr_block:
                    curr_block['lines'].append(line)
            
            if curr_block:
                raw_blocks.append(curr_block)
            
            for blk in raw_blocks:
                q_num = blk['question_number']
                ans_key = blk['answer_key']
                q_lines = blk['lines']
                
                q_text = blk['first_line_rest'].strip()
                explanation = ''
                options = {'A': None, 'B': None, 'C': None, 'D': None}
                
                if ans_key:
                    explanation = '\n'.join(q_lines).strip()
                    clean_first = re.sub(r'^(?:Q\s*\.?\s*)?\d{1,4}\s*[\.\)]\s*(?:\([a-dA-D]\)\s*[:\.]?\s*)?', '', q_lines[0]).strip()
                    q_text = clean_first or f'Question #{q_num}'
                else:
                    # Regular question with options
                    # Find all lines that contain options or answers
                    q_text_lines = [blk['first_line_rest'].strip()]
                    opt_lines = []
                    in_opts = False
                    in_explanation = False
                    
                    for l in q_lines[1:]:
                        l_str = l.strip()
                        # Check if line contains an option flag like (a), (b), (c), (d) or a), b) etc
                        has_opt = bool(re.search(r'(?:^|\s)(?:\(?([a-dA-D])\)[\.\:]?|\b([a-dA-D])[\.\)])\s+', l_str))
                        ans_match = re.search(r'(?:answer|ans|key)\s*[:\.]?\s*([A-D])', l_str, re.IGNORECASE)
                        exp_match = re.search(r'(?:explanation|solution|sol\.?)\s*[:\.]?\s*(.*)', l_str, re.IGNORECASE)
                        
                        if ans_match:
                            ans_key = ans_match.group(1).upper()
                        elif exp_match:
                            in_explanation = True
                            explanation += exp_match.group(1) + '\n'
                        elif in_explanation:
                            explanation += l_str + '\n'
                        elif has_opt:
                            in_opts = True
                            opt_lines.append(l_str)
                        elif in_opts:
                            # Continuation of previous option
                            opt_lines.append(l_str)
                        else:
                            q_text_lines.append(l_str)
                            
                    q_text = '\n'.join([x for x in q_text_lines if x]).strip()
                    
                    # Parse all options from opt_lines
                    if opt_lines:
                        opt_block = ' '.join(opt_lines)
                        opt_matches = list(re.finditer(r'(?:^|\s)(?:\(?([a-dA-D])\)[\.\:]?|\b([a-dA-D])[\.\)])\s*', opt_block))
                        for idx, om in enumerate(opt_matches):
                            key = (om.group(1) or om.group(2)).upper()
                            start_idx = om.end()
                            end_idx = opt_matches[idx + 1].start() if idx + 1 < len(opt_matches) else len(opt_block)
                            val = opt_block[start_idx:end_idx].strip()
                            # Strip any trailing exam year e.g. (2008)
                            val = re.sub(r'\s*\((?:19|20)\d{2}\)\s*$', '', val).strip()
                            if key in options:
                                options[key] = val
                
                # Check for trailing exam year on question text if any
                all_questions.append({
                    'question_number': q_num,
                    'page_number': page_num,
                    'question_text': q_text.strip(),
                    'option_a': options['A'],
                    'option_b': options['B'],
                    'option_c': options['C'],
                    'option_d': options['D'],
                    'options_json': options,
                    'original_answer_key': ans_key,
                    'original_explanation': explanation.strip() or None,
                })
    return all_questions

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extract_questions.py <pdf_path>')
        sys.exit(1)
    res = parse_questions_from_pdf(sys.argv[1])
    print(json.dumps(res))
