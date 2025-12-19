import React, { useRef } from 'react';
import { useState } from 'react';
import { useEffect } from 'react';
import axios from 'axios';
import { ChevronFirst, ChevronLast, Inbox, LoaderCircle, Search, SkipBack, SkipForward } from 'lucide-react';
import useWebSocket from "react-use-websocket"
import { toast } from 'react-toastify';
import ProtocolPieChart from '../components/ProtocolPieChart';
import { useSearchParams } from 'react-router-dom';

const Traffic = () => {
    const [searchParams] = useSearchParams();
    const initialSearch = searchParams.get('search') || '';

    const [data, setData] = useState([]);
    // const [totalAlertCount, setTotalAlertCount] = useState(0);
    const [loader, setLoader] = useState(true);
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [live, setLive] = useState(true);
    const [page, setPage] = useState(1);
    const debounceTimer = useRef(null);
    const noitems = 7;

    const { lastMessage } = useWebSocket(import.meta.env.VITE_WS, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000
    })

    const getData = async (search = searchQuery) => {
        try {
            setLoader(true)
            const res = await axios.get(`${import.meta.env.VITE_BACK}/logs`, {
                withCredentials: true,
                params: {
                    search,
                    page
                }
            })
            console.log(res.data)
            setData(res.data);
            setLoader(false)
        } catch (error) {
            console.log(error);
        }
    }

    const applySearch = (e) => {
        const search = e.target.value;
        setSearchQuery(search)

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
        }

        debounceTimer.current = setTimeout(async () => {
            setPage(1)
            await getData(search)

        }, 750);

    }

    const getPageOptions = () => {
        const totalPages = Math.ceil(data.alertCount / data.noItems)
        const options = []
        for (let i = 0 ; i < totalPages ; i++){
            options.push(
                <option selected={page == i+1} value={i+1} className='text-white'>{i+1}</option>
            )
        }
        return options
    }

    useEffect(() => {
        getData()
    }, [page])


    // web socket

    useEffect(() => {
        try {
            if (!live) return;
            const message = JSON.parse(lastMessage.data);
            if (message.type == 'new_alert') {
                if (page !== 1) setPage(1)
                setData((prev) => {
                    return {
                        ...prev,
                        alertCount: prev.alertCount + 1,
                        alerts: [
                            message.data,
                            ...prev.alerts.slice(0, prev.alerts.length == noitems ? prev.alerts.length - 1 : prev.alerts.length)
                        ]
                    }
                })
                toast.info(message.data.signature)
            }
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    }, [lastMessage])

    const getProtocolbg = (protocol) => {
        if (protocol == "TCP") return "bg-blue-700"
        else if (protocol == "UDP") return "bg-yellow-600"
        else return "bg-green-700"
    }

    const getSeverity = (severity) => {
        if (severity == 3) {
            return <span className='bg-green-700 text-[#EAEAEA] py-1 px-2 rounded-lg'>Low</span>
        } else if (severity == 2) {
            return <span className='bg-yellow-600 text-[#EAEAEA] py-1 px-2 rounded-lg'>Medium</span>
        } else {
            return <span className='bg-red-600 text-[#EAEAEA] py-1 px-2 rounded-lg'>High</span>
        }
    }

    const getLiveButton = () => {
        const click = () => {
            if (!live) getData()
            setLive(!live)
        }
        if (live) {
            return <button className='flex items-center justify-center border border-white px-4 py-2 gap-x-2 hover:cursor-pointer rounded-md ' onClick={click} >
                <svg width={20} height={20} className='' >
                    <circle cx={10} cy={10} r={10} className='fill-red-700 animate-pulse ' />
                </svg>
                <p className=''>Live</p>
            </button>
        } else {
            return <button className='flex items-center justify-center border-3 border-gray-500 px-4 py-2 gap-x-2 hover:cursor-pointer rounded-md' onClick={click}>
                <svg width={20} height={20} className='' >
                    <circle cx={10} cy={10} r={10} className='fill-gray-500' />
                </svg>
                <p className=''>Paused</p>
            </button>
        }
    }

    const getPaginationButtons = () => {
        let buttons = [];
        const normalButton = "bg-[#111828] p-1 rounded-sm hover:cursor-pointer w-8";
        const currentButton = "border-2 border-primary bg-[#111828] p-1 text-primary w-8 rounded-sm text-black"
        const totalPages = Math.ceil(data.alertCount / data.noItems);
        buttons.push(
            <button className={(page == 1 ? "" : 'hover:cursor-pointer ') + "bg-[#111828] rounded-sm p-1"} onClick={() => setPage(1)}>
                <ChevronFirst className={page == 1 && ' text-gray-500'} />
            </button>
        )
        if (page == 1) {
            for (let i = 1; i <= totalPages && i < 4; i++) {
                console.log(i)
                buttons.push(
                    <button disabled={page == i} className={i == page ? currentButton : normalButton} onClick={() => setPage(i)}>
                        {i}
                    </button>)
            }
        } else if (page == totalPages) {
            for (let i = page; i > page - 3 && i > 0; i--) {
                buttons.push(
                    <button disabled={page == i} className={i == page ? currentButton : normalButton} onClick={() => setPage(i)}>
                        {i}
                    </button>)
            }
            buttons = [buttons[0] , ...buttons.slice(1).reverse()]
        } else {
            for (let i = page - 1; i < page + 2; i++) {
                buttons.push(
                    <button  disabled={page == i} className={i == page ? currentButton : normalButton} onClick={() => setPage(i)}>
                        {i}
                    </button>)
            }
        }
        buttons.push(
            <button className={(page == 1 ? "" : 'hover:cursor-pointer ') + "bg-[#111828] rounded-sm p-1"}  onClick={() => {setPage(totalPages)}}>
                <ChevronLast className={page == totalPages && "text-gray-500"}/>
            </button>)

        return buttons;
    }

    return (
        <main className="flex-1 p-8 overflow-y-auto bg-background-dark">
            <div className="flex flex-wrap justify-between gap-4 mb-4">
                <div className="flex flex-col gap-1">
                    <p className="text-3xl font-bold text-[#EAEAEA]">Packet Inspection</p>
                    <p className="text-sm text-[#EAEAEA]/60">Monitor and analyze network packets in real-time.</p>
                </div>

            </div>

            {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                
                Protocol Breakdown

                <div className="lg:col-span-1 bg-[#2C3036] rounded-xl p-6 border border-transparent hover:border-[#00FFFF] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]">
                    <h3 className="text-lg font-semibold text-[#EAEAEA] mb-4">Protocol Breakdown</h3>
                    <div className="flex justify-center items-center h-56">
                        <div className="relative w-48 h-48">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                                <path className="stroke-current text-[#007BFF]/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth={3} />
                                <path className="stroke-current text-[#00FFFF]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" strokeDasharray="60, 100" strokeDashoffset={0} strokeWidth={3} />
                                <path className="stroke-current text-[#007BFF]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" strokeDasharray="25, 100" strokeDashoffset={-60} strokeWidth={3} />
                                <path className="stroke-current text-purple-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" strokeDasharray="15, 100" strokeDashoffset={-85} strokeWidth={3} />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold">1.2M</span>
                                <span className="text-sm text-[#EAEAEA]/60">Packets</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-[#00FFFF]" />
                                <span>TCP</span>
                            </div>
                            <span>60%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-[#007BFF]" />
                                <span>UDP</span>
                            </div>
                            <span>25%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-purple-500" />
                                <span>ICMP</span>
                            </div>
                            <span>15%</span>
                        </div>
                    </div>
                </div>
                
                Live Connection Cards
                
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-[#EAEAEA] px-2">Live Connections</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#2C3036] rounded-xl p-4 border border-transparent hover:border-[#00FFFF] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-green-400">Inbound</span>
                                <span className="text-xs text-[#EAEAEA]/60">2m 15s</span>
                            </div>
                            <p className="text-sm text-[#EAEAEA]">198.51.100.12 <span className="text-[#EAEAEA]/60">to</span>
                                192.168.1.103</p>
                            <p className="text-xs text-[#EAEAEA]/60">UDP / Port 5060</p>
                        </div>
                        <div className="bg-[#2C3036] rounded-xl p-4 border border-transparent hover:border-[#00FFFF] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-blue-400">Outbound</span>
                                <span className="text-xs text-[#EAEAEA]/60">5m 42s</span>
                            </div>
                            <p className="text-sm text-[#EAEAEA]">192.168.1.102 <span className="text-[#EAEAEA]/60">to</span>
                                10.0.0.5</p>
                            <p className="text-xs text-[#EAEAEA]/60">TCP / Port 443</p>
                        </div>
                        <div className="bg-[#2C3036] rounded-xl p-4 border border-transparent hover:border-red-500 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-red-500">Blocked</span>
                                <span className="text-xs text-[#EAEAEA]/60">0m 5s</span>
                            </div>
                            <p className="text-sm text-[#EAEAEA]">203.0.113.25 <span className="text-[#EAEAEA]/60">to</span>
                                192.168.1.101</p>
                            <p className="text-xs text-[#EAEAEA]/60">TCP / Port 22</p>
                        </div>
                        <div className="bg-[#2C3036] rounded-xl p-4 border border-transparent hover:border-[#00FFFF] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-blue-400">Outbound</span>
                                <span className="text-xs text-[#EAEAEA]/60">12m 02s</span>
                            </div>
                            <p className="text-sm text-[#EAEAEA]">192.168.1.105 <span className="text-[#EAEAEA]/60">to</span>
                                203.0.113.7</p>
                            <p className="text-xs text-[#EAEAEA]/60">UDP / Port 53</p>
                        </div>
                    </div>
                </div>
            </div> */}

            <div className="flex w-1/2">
                {/* <ProtocolPieChart/> */}
            </div>


            {/* live and search bar */}

            <div className="bg-card-dark p-3 mb-3 rounded-lg flex">
                {getLiveButton()}
                <div className="flex items-center gap-4 ml-4 rounded border border-[#EAEAEA] w-full">
                    <label className="flex flex-col min-w-90 w-full">
                        <div className="flex w-full flex-1 items-stretch rounded-lg h-12 ">
                            <div className="text-[#EAEAEA]/60 flex bg-card-dark items-center justify-center pl-4 rounded-l-lg border-r-0">
                                <Search />
                            </div>
                            <input
                                value={searchQuery}
                                onChange={applySearch}
                                className="form-input bg-card-dark p-4 focus:outline-0 overflow-hidden rounded-r-lg w-full"
                                placeholder="Search by IP, protocol, or port..." />
                        </div>
                    </label>
                </div>
            </div>

            {/* main table */}

            <div className="bg-card-dark rounded-xl overflow-hidden border border-transparent focus-within:border-[#00FFFF] shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#101d2e]">
                            <tr>
                                <th className="p-4 font-semibold text-[#EAEAEA]/80">Time</th>
                                <th className="p-4 font-semibold text-[#EAEAEA]/80">Source Address</th>
                                <th className="p-4 font-semibold text-[#EAEAEA]/80">Destination Address</th>
                                <th className="p-4 font-semibold text-[#EAEAEA]/80">Protocol</th>
                                <th className="p-4 font-semibold text-[#EAEAEA]/80">Signature</th>
                                <th className="p-4 font-semibold text-[#EAEAEA]/80">Severity</th>
                            </tr>
                        </thead>

                        {loader ?
                            <tbody>
                                <tr>
                                    <td colSpan={6} className='align-center h-40'>
                                        <LoaderCircle className='animate-spin m-auto' size={64} />
                                    </td>
                                </tr>
                            </tbody>
                            :
                            <tbody className="divide-y divide-[#1A1D21]">
                                {data.alerts.length > 0 ?
                                    data.alerts.map(alert => {
                                        return <tr key={alert.id} className="hover:bg-[#1A1D21]/50 transition-colors">
                                            <td className="p-4 text-[#EAEAEA]">{new Date(alert.createdAt).toLocaleString()}</td>
                                            <td className="p-4 text-[#EAEAEA]">{alert.src_ip}:{alert.src_port}</td>
                                            <td className="p-4 text-[#EAEAEA]">{alert.dest_ip}:{alert.dest_port}</td>
                                            <td className="p-4 text-[#EAEAEA] text-center">
                                                <span className={`${getProtocolbg(alert.protocol)} py-1 px-2 rounded-lg`}>
                                                    {alert.protocol}
                                                </span>
                                            </td>
                                            <td className="p-4 text-[#EAEAEA]">{alert.signature.slice(0, 45)}...</td>
                                            <td className="p-4 text-[#EAEAEA] text-center">{getSeverity(alert.severity)}</td>
                                        </tr>
                                    })
                                    :
                                    <tr className='h-40'>
                                        <td colSpan={6} className='items-center align-middle text-center'>
                                            <Inbox className='m-auto text-gray-500' size={36} />
                                            <p className='text-gray-500 text-lg'>No alerts to display</p>
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        }
                    </table>
                </div>
            </div>

            {/* pagination */}
            {
                loader ?
                    ""
                    :
                    data.alerts.length > 0 ?
                        <div className="bg-card-dark mt-3 p-3 rounded-lg flex justify-between items-center align-middle">

                            <div>
                                <p className="text-gray-500 text-sm">
                                    {`Showing ${(page - 1) * data.noItems + 1}–${Math.min(page * data.noItems, data.alertCount)} of ${data.alertCount}`}
                                </p>

                            </div>

                            <div className='flex items-center gap-2'>

                                {getPaginationButtons()}

                            </div>

                            <div className='flex gap-2'>
                                <p>jump to</p>
                                <select className='w-20 bg-[#111828] rounded-sm text-center outline-none' onChange={(e) => {
                                    setPage(+e.target.value);
                                }}>
                                    {getPageOptions()}
                                </select>
                            </div>

                        </div>
                        :
                        ""
            }


        </main>

    );
}

export default Traffic;
