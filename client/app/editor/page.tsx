'use client';
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { toast } from 'react-hot-toast';
import Editor from './editor';
import Terminal from './terminal';
import { Button } from '@/components/ui/button';
import { initSocket } from '../Socket';
import { Socket } from 'socket.io-client';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ACTIONS } from '@/lib/Actions';
import { Copy } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface Client {
    socketId: string;
    username: string;
}

interface JoiningDataType {
    clients: Client[];
    username: string;
    socketId: string;
    roomCode: {
        lang: string,
        code: string,
        output: {
            cpuUsage: number;
            exitCode: number;
            memoryUsage: number;
            signal: number;
            stderr: string;
            stdout: string;
        };
    };
}

const ActualPage: React.FC<{ searchParams: ReturnType<typeof useSearchParams> }> = ({ searchParams }) => {
    const data = {
        roomId: searchParams.get('roomId') as string,
        username: searchParams.get('username') as string,
    };
    const socketRef = useRef<Socket | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [code, setCode] = useState<string>("for(let i = 0; i < 5; i++) console.log(i);");
    const [language, setLanguage] = useState<string>('javascript');
    const languages: string[] = ['c', 'cpp', 'javascript', 'python', 'java'];
    const [codeOutput, setCodeOutput] = useState<string>('Run Code to see output.');

    const router = useRouter();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
    const initialized = useRef(false);

    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;

            const init = async () => {
                socketRef.current = await initSocket();

                const handleErrors = (err: any) => {
                    console.log('Error', err);
                    toast.error('Socket connection failed, Try again later');
                    router.push('/');
                };

                if (socketRef.current) {
                    socketRef.current.on('connect_error', handleErrors);
                    socketRef.current.on('connect_failed', handleErrors);

                    socketRef.current.emit(ACTIONS.JOIN, {
                        roomId: data.roomId,
                        username: data.username,
                    });

                    socketRef.current.on(
                        ACTIONS.JOINED,
                        ({ clients, username, socketId, roomCode }: JoiningDataType) => {
                            if (username !== data.username) {
                                toast.success(`${username} joined the room.`);
                            }
                            setClients(clients);
                            setLanguage(roomCode.lang);
                            setCode(roomCode.code);
                            if (roomCode.output.stdout !== "") setCodeOutput(roomCode.output.stdout);
                            else if (roomCode.output.stderr !== "") setCodeOutput(roomCode.output.stderr);
                        }
                    );

                    socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }: { socketId: string; username: string }) => {
                        toast.success(`${username !== data.username ? username : "You"} left the room`);
                        setClients((prev) => prev.filter((client) => client.socketId !== socketId));
                    });

                    socketRef.current.on(ACTIONS.RUN_CODE, ({ output }: { output: any }) => {
                        if (output.stdout !== "") setCodeOutput(output.stdout);
                        else if (output.stderr !== "") setCodeOutput(output.stderr);
                    });

                    socketRef.current.on(ACTIONS.CODE_CHANGE, ({ updatedCode, user }: { updatedCode: string; user: string }) => {
                        if (!typingUsers.includes(user)) {
                            setTypingUsers((prev) => [...prev, user]);
                        }

                        if (typingTimeouts.current[user]) {
                            clearTimeout(typingTimeouts.current[user]);
                        }

                        typingTimeouts.current[user] = setTimeout(() => {
                            setTypingUsers((prev) => prev.filter((u) => u !== user));
                        }, 1000);

                        setCode(updatedCode);
                    });

                    socketRef.current.on(ACTIONS.CHANGE_LANG, ({ language }: { language: string }) => {
                        setLanguage(language);
                    });
                }
            };

            init();

            return () => {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                    socketRef.current.off(ACTIONS.JOIN);
                    socketRef.current.off(ACTIONS.JOINED);
                    socketRef.current.off(ACTIONS.DISCONNECTED);
                    socketRef.current.off(ACTIONS.RUN_CODE);
                    socketRef.current.off(ACTIONS.CODE_CHANGE);
                    socketRef.current.off(ACTIONS.CHANGE_LANG);
                }

                Object.values(typingTimeouts.current).forEach(clearTimeout);
            };
        }
    }, [data.roomId, data.username, router, typingUsers]);

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(data.roomId);
            toast.success('Room ID is copied');
        } catch (error) {
            console.log(error);
            toast.error('Unable to copy the room ID');
        }
    };

    const runCode = () => {
        socketRef.current?.emit(ACTIONS.RUN_CODE, { roomId: data.roomId, code, language });
    };

    const changeLang = (lang: string) => {
        setLanguage(lang);
        socketRef.current?.emit(ACTIONS.CHANGE_LANG, { roomId: data.roomId, language: lang });
    };

    return (
        <div className="flex h-[calc(100vh-58px)] w-full">
            <div className="flex flex-col justify-between items-center border-r w-20 gap-2">
                <div className="flex flex-col w-full h-full justify-start items-center gap-5 overflow-y-auto py-2">
                    {clients.map((client, i) => (
                        <TooltipProvider key={i}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className='relative cursor-pointer'>
                                        <Avatar>
                                            <AvatarFallback>{client.username[0].toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        {typingUsers.includes(client.username) && (
                                            <div className='absolute z-10 right-[-12px] bottom-[-15px] bg-slate-500/50 text-[10px] rounded-lg p-1'>
                                                typing...
                                            </div>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{client.username}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>
                <Button onClick={copyRoomId} variant="outline" size="icon" className='m-2'><Copy /></Button>
            </div>
            <div className="flex-grow">
                <ResizablePanelGroup direction="vertical" className="min-h-[200px] w-full">
                    <ResizablePanel defaultSize={80}>
                        <div className="flex h-full">
                            <Editor socketRef={socketRef.current} roomId={data.roomId} code={code} language={language} user={data.username} setCode={setCode} />
                        </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={20}>
                        <div className="flex flex-col h-full">
                            <div className="flex-grow overflow-y-auto">
                                <Terminal codeOutput={codeOutput} />
                            </div>
                            <div className="flex justify-end items-end gap-2 w-full p-2">
                                <div>
                                    <Select onValueChange={changeLang}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder={language} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {languages.map((lang, i) => <SelectItem value={lang} key={i}>{lang}</SelectItem>)}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={runCode}>Run</Button>
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
};

const Page: React.FC = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SearchPageContent />
        </Suspense>
    );
};

// This component directly uses `useSearchParams`
const SearchPageContent: React.FC = () => {
    const searchParams = useSearchParams();
    return <ActualPage searchParams={searchParams} />;
};

export default Page;
