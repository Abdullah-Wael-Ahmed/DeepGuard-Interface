import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios"
import {
  Search,
  RefreshCw,
  Download,
  Play,
  Pause,
  Filter,
  Eye,
  Activity,
  Columns,
  Loader,
  LoaderCircle,
  CircleAlert
} from "lucide-react";
import { toast } from "react-toastify";
import Modal from "@/components/ui/modal";

export default function TrafficInspection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCapturing, setIsCapturing] = useState(true);
  const [trafficData, setTrafficData] = useState([]);
  const [totalAlertCount, setTotalAlertCount] = useState(0)
  const [loader, setLoader] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalContent, setModalContent] = useState("")
  const pausedWsRef = useRef(false)
  const debounceTimer = useRef(null)
  const searchRef = useRef("")
  const noItemsPerPage = 7
  const notify = (alert) => toast.warning(alert.slice(0, 35) + "...", { position: "top-right" });

  const getData = async (search = searchQuery) => {
    try {
      setLoader(true)
      const backend = import.meta.env.VITE_BACKEND
      const res = await axios.get(backend + "/logs", {
        withCredentials: true,
        params: {
          page: page,
          search: search
        }
      })
      setTrafficData(res.data.alerts)
      setTotalAlertCount(res.data.alertCount)
      setPagination(getPagination(page, Math.ceil(res.data.alertCount / noItemsPerPage), 3))
      setLoader(false)
    } catch (error) {
      console.log(error)
    }
  }

  const applysSearch = (e) => {
    const search = e.target.value
    setSearchQuery(search)
    searchRef.current = search

    if (debounceTimer.current){
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {      

        await getData(search)
        
    }, 750);
  }

  useEffect(() => {
    getData();
    console.log("rerender")
  }, [page])

  useEffect(() => {
  let socket

  try {
    socket = new WebSocket(import.meta.env.VITE_WS)
    socket.onopen = () => console.log("websocket connected")

    socket.onmessage = (event) => {
      if (pausedWsRef.current) return
      const message = JSON.parse(event.data)

      if (message.type === "new_alert") {
        if (
          !(
            `${message.data.src_ip}:${message.data.src_port}`.includes(searchRef.current) ||
            `${message.data.dest_ip}:${message.data.dest_port}`.includes(searchRef.current) ||
            message.data.protocol.includes(searchRef.current)
          )
        ) {
          return
        }

        notify(message.data.signature)
        setPage(1)
        setTrafficData((prev) => [message.data, ...prev.slice(0, prev.length - 1)])
        setTotalAlertCount((prev) => {
          const updated = prev + 1
          setPagination(getPagination(page, Math.ceil(updated / noItemsPerPage), 3))
          return updated
        })
      }
    }
  } catch (error) {
    console.log(error)
  }

  // ✅ cleanup runs when component unmounts or effect re-runs
  return () => {
    if (socket) {
      console.log("closing websocket")
      socket.close()
    }
  }
}, [])


  // Mock traffic data
  // [
  //   {
  //     timestamp: "2024-07-26 14:30:01",
  //     sourceIp: "192.168.1.10",
  //     sourcePort: "54321",
  //     destinationIp: "172.217.160.142",
  //     destinationPort: "443",
  //     protocol: "TCP",
  //     l7App: "HTTPS",
  //     payloadPreview: "GET /index.html HTTP/1.1...",
  //     sessionId: "SESS-001A",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:02",
  //     sourceIp: "10.0.0.5",
  //     sourcePort: "80",
  //     destinationIp: "192.168.1.100",
  //     destinationPort: "60000",
  //     protocol: "TCP",
  //     l7App: "HTTP",
  //     payloadPreview: "200 OK Content-Type: text/html...",
  //     sessionId: "SESS-001B",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:03",
  //     sourceIp: "192.168.1.20",
  //     sourcePort: "53210",
  //     destinationIp: "8.8.8.8",
  //     destinationPort: "53",
  //     protocol: "UDP",
  //     l7App: "DNS",
  //     payloadPreview: "Query: example.com A...",
  //     sessionId: "SESS-001C",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:04",
  //     sourceIp: "172.16.0.1",
  //     sourcePort: "22",
  //     destinationIp: "192.168.1.10",
  //     destinationPort: "58901",
  //     protocol: "TCP",
  //     l7App: "SSH",
  //     payloadPreview: "SSH-2.0-OpenSSH_8.9...",
  //     sessionId: "SESS-001D",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:05",
  //     sourceIp: "192.168.1.10",
  //     sourcePort: "54322",
  //     destinationIp: "172.217.160.142",
  //     destinationPort: "443",
  //     protocol: "TCP",
  //     l7App: "HTTPS",
  //     payloadPreview: "POST /api/data HTTP/1.1...",
  //     sessionId: "SESS-001E",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:06",
  //     sourceIp: "10.0.0.6",
  //     sourcePort: "8080",
  //     destinationIp: "192.168.1.101",
  //     destinationPort: "60001",
  //     protocol: "TCP",
  //     l7App: "HTTP",
  //     payloadPreview: "404 Not Found...",
  //     sessionId: "SESS-001F",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:07",
  //     sourceIp: "192.168.1.25",
  //     sourcePort: "53211",
  //     destinationIp: "8.8.4.4",
  //     destinationPort: "53",
  //     protocol: "UDP",
  //     l7App: "DNS",
  //     payloadPreview: "Query: google.com MX...",
  //     sessionId: "SESS-001G",
  //   },
  //   {
  //     timestamp: "2024-07-26 14:30:08",
  //     sourceIp: "172.16.0.2",
  //     sourcePort: "3389",
  //     destinationIp: "192.168.1.11",
  //     destinationPort: "58902",
  //     protocol: "TCP",
  //     l7App: "RDP",
  //     payloadPreview: "RDP Connection Request...",
  //     sessionId: "SESS-001H",
  //   },
  // ];


  function getPagination(currentPage, totalPages, maxVisiblePages = 5) {
    const pages = [];

    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(totalPages - 1, start + maxVisiblePages - 1);

      pages.push(1); // Always show first page

      if (start > 2) pages.push("...");

      for (let i = start; i <= end; i++) pages.push(i);

      if (end < totalPages - 1) pages.push("...");

      pages.push(totalPages); // Always show last page
    }

    return pages;
  }

  const exportTrafficData = () => {
    const headers = [
      "Timestamp",
      "Source IP",
      "Source Port",
      "Destination IP",
      "Destination Port",
      "Protocol",
      "L7 Application",
      "Payload Preview",
      "Session ID",
    ];

    const csvContent = [
      headers.join(","),
      ...trafficData.map((traffic) =>
        [
          traffic.timestamp,
          traffic.sourceIp,
          traffic.sourcePort,
          traffic.destinationIp,
          traffic.destinationPort,
          traffic.protocol,
          traffic.l7App,
          `"${traffic.payloadPreview.replace(/"/g, '""')}"`,
          traffic.sessionId,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `traffic-data-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Network Traffic Inspection
          </h1>
          <p className="text-muted-foreground">
            Analyze real-time network traffic, inspect packet details, and apply
            advanced filters to diagnose anomalies and secure your network
          </p>
        </div>
      </div>

      {/* Traffic Controls */}
      <Card className="p-6 bg-[#0A2342] text-white shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground text-white">
            Traffic Filters & Actions
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Button
            variant={"default"}
            onClick={() => {
              setIsCapturing(!isCapturing)
              pausedWsRef.current = !pausedWsRef.current
              if (pausedWsRef.current == false) getData()
            }}
            className="bg-gradient-primary text-white hover:opacity-90"
          >
            {isCapturing ? (
              <Pause className="w-4 h-4 mr-2"  />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isCapturing ? "Pause Capture" : "Start Capture"}
          </Button>
{/* 
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2 text-[#0A2342]" />

            <span className="text-[#0A2342]">Show Filters</span>
          </Button>

          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2 text-[#0A2342]" />
            <span className="text-[#0A2342]">Refresh</span>
          </Button>

          <Button variant="outline" onClick={exportTrafficData}>
            <Download className="w-4 h-4 mr-2 text-[#0A2342]" />
            <span className="text-[#0A2342]">Export Data</span>
          </Button> */}

          <div className="flex-1 ">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search traffic..."
                value={searchQuery}
                onChange={applysSearch}
                className="pl-10 text-black"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Live Traffic Log */}
      <Card className="bg-[#0A2342] text-white shadow-card">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground text-white">
                Live Traffic Log
              </h3>
              {isCapturing && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-sm text-success">Live</span>
                </div>
              )}
            </div>
            {/* <Button variant="ghost" size="sm">
              <Columns className="w-4 h-4 mr-2" />
              Columns
            </Button> */}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Timestamp
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Source IP:Port
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Destination IP:Port
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Protocol
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Severity
                </th>
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Signature
                </th>
                {/* <th className="text-left p-4 font-medium text-foreground text-white">
                  Session ID
                </th> */}
                <th className="text-left p-4 font-medium text-foreground text-white">
                  Actions
                </th>
              </tr>
            </thead>
            {loader ?
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <div className=" flex h-64 w-ful justify-center items-center">
                      <LoaderCircle className="animate-spin h-12 w-12" />
                    </div>
                  </td>
                </tr>
              </tbody>
              :
              <tbody>
                {trafficData.map((traffic, index) => (
                  <tr
                    key={index}
                    className="border-b border-border hover:bg-muted/10 transition-colors"
                    onClick={() => {setIsModalOpen(true)
                      setModalContent(traffic)}}
                  >
                    <td className="p-4">
                      <span className="font-mono text-sm text-foreground text-white">
                        {new Date(traffic.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm text-foreground text-white">
                        {traffic.src_ip}:{traffic.src_port}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm text-foreground text-white">
                        {traffic.dest_ip}:{traffic.dest_port}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        variant={
                          traffic.protocol === "TCP"
                            ? "info"
                            : traffic.protocol === "UDP"
                              ? "warning"
                              : "default"
                        }
                      >
                        {traffic.protocol}
                      </StatusBadge>
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        variant={
                          traffic.severity === 1
                            ? "critical"
                            : traffic.severity === 2
                              ? "warning"
                              : traffic.severity === 3
                                ? "low"
                                : "default"
                        }
                      >
                        {traffic.severity === 1 ? "High" : traffic.severity === 2 ? "Medium" : "Low"}
                      </StatusBadge>
                    </td>
                    <td className="p-4 max-w-xs">
                      <span className="font-mono text-sm text-muted-foreground text-white truncate block">
                        {traffic.signature.length >= 35 ? traffic.signature.slice(0,33)+"..." : traffic.signature}
                      </span>
                    </td>
                    {/* <td className="p-4">
                    <span className="font-mono text-sm text-muted-foreground text-white">
                      {traffic.sessionId}
                    </span>
                  </td> */}
                    <td className="p-4">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            }


          </table>
        </div>

        {trafficData.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No traffic data matches your current filters</p>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          {!loader &&
            <>
              <div className="text-sm text-muted-foreground">
                {`Showing ${(page - 1) * noItemsPerPage + 1}–${Math.min(page * noItemsPerPage, totalAlertCount)} of ${totalAlertCount}`}
              </div>
              <div className="flex items-center gap-2 text-[#0A2342]">
                <Button variant="outline" size="sm" disabled={page == 1} onClick={() => {
                  setPage(page - 1)
                }}>
                  ← Previous
                </Button>
                {pagination.map((num) => {
                  return <Button key={num} variant="outline" size="sm" disabled={num == page} onClick={() => {
                    if (num != "...") {
                      setPage(num)
                    }
                  }}>
                    {num}
                  </Button>
                })}
                <Button variant="outline" size="sm" disabled={Math.ceil(totalAlertCount / noItemsPerPage) == page} onClick={() => {
                  setPage(page + 1)
                }}>
                  Next →
                </Button>
              </div>
            </>
          }
        </div>
      </Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} alert={modalContent}/>
    </div>
  );
}
