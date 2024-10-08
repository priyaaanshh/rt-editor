import React, { useEffect, useRef } from 'react';
import { CodeiumEditor } from "@codeium/react-code-editor";
import { ACTIONS } from '../../lib/Actions';
import * as monaco from 'monaco-editor'; // Import monaco editor types if needed
import { Socket } from 'socket.io-client';
import { useTheme } from "next-themes"

interface EditorProps {
    socketRef: Socket | null;
    roomId: string;
    code: string;
    language: string;
    user: string;
    setCode: (code: string) => void;
}

const Editor: React.FC<EditorProps> = ({ socketRef, roomId, code, language, user, setCode }) => {
    const { theme } = useTheme()
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const onMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
        editorRef.current = editor;
        editor.focus();
    };

    const onChange = (value: string | undefined, ev: monaco.editor.IModelContentChangedEvent) => {
        if (value !== undefined) {
            setCode(value);
            if(socketRef){
                socketRef.emit(ACTIONS.CODE_CHANGE, { roomId, user, newCode: value });
            }
        }
    };

    return (
        <CodeiumEditor
            language={language}
            theme={theme === "dark" ? "vs-dark" : "light"}
            height="100%"
            width="100%"
            onMount={onMount}
            defaultValue={code}
            value={code}
            onChange={onChange}
        />
    );
};

export default Editor;
