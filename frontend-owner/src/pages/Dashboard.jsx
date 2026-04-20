import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import { ENABLE_PAYMENT } from '../config/payment';
import {
  getStoredNotificationReady,
  getStoredNotificationSound,
  playNotificationPreset,
  setStoredNotificationReady,
} from '../utils/notificationSounds';
import './Dashboard.css';

const ALERT_BANNER_DURATION_MS = 5000;
const ORDER_HIGHLIGHT_DURATION_MS = 6000;
const DASHBOARD_LEADER_KEY = 'ownerDashboardPollingLeader';
const DASHBOARD_SYNC_FALLBACK_KEY = 'ownerDashboardSyncMessage';
const DASHBOARD_LEASE_MS = 15000;
const DASHBOARD_LEADER_HEARTBEAT_MS = 5000;
const DASHBOARD_SYNC_CHANNEL = 'owner-dashboard-sync';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [payAtCounterOrders, setPayAtCounterOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'prep' | 'completed'
  const [viewMode, setViewMode] = useState('normal'); // 'normal' | 'kitchen'
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedRemovedItems, setSelectedRemovedItems] = useState([]);
  const [editingOrderBusy, setEditingOrderBusy] = useState(false);
  const [notificationReady, setNotificationReady] = useState(false);
  const [isPollingLeader, setIsPollingLeader] = useState(false);
  const [alertBanner, setAlertBanner] = useState(null);
  const [recentNewOrderIds, setRecentNewOrderIds] = useState([]);
  const [screenFlashVisible, setScreenFlashVisible] = useState(false);
  const previousOrderIdsRef = useRef(new Set());
  const notificationReadyRef = useRef(false);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const bannerTimeoutRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const screenFlashTimeoutRef = useRef(null);
  const soundResetTimeoutRef = useRef(null);
  const latestSeenOrderIdRef = useRef(null);
  const latestFiltersRef = useRef({});
  const pollingLeaderRef = useRef(false);
  const tabIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const syncChannelRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const leaderCheckIntervalRef = useRef(null);
  const syncRefreshTimeoutRef = useRef(null);
  const allOrdersSignatureRef = useRef('');

  useEffect(() => {
    latestFiltersRef.current = {
      activeTab,
      statusFilter,
      paymentFilter,
      sortBy,
      sortOrder,
      viewMode,
    };
  }, [activeTab, statusFilter, paymentFilter, sortBy, sortOrder, viewMode]);

  useEffect(() => {
    if (!isPollingLeader) {
      return undefined;
    }

    fetchAllData(true, { broadcastChanges: false });
    const interval = setInterval(() => {
      fetchAllData(false, { broadcastChanges: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [isPollingLeader, activeTab, statusFilter, paymentFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isPollingLeader || !isInitialLoad) {
      return undefined;
    }

    fetchAllData(true, {
      suppressNotifications: true,
      broadcastChanges: false,
    });

    return undefined;
  }, [isPollingLeader, isInitialLoad, activeTab, statusFilter, paymentFilter, sortBy, sortOrder]);

  useEffect(() => {
    const primeAudio = async () => {
      if (typeof window === 'undefined') {
        return;
      }

      if (!audioRef.current) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 1;
        audioRef.current = audio;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current?.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (error) {
          console.error('Failed to unlock audio context:', error);
        }
      }
    };

    const enableNotifications = async () => {
      notificationReadyRef.current = true;
      setStoredNotificationReady(true);
      setNotificationReady(true);
      await primeAudio();

      if (typeof window === 'undefined' || !('Notification' in window)) {
        return;
      }

      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (error) {
          console.error('Notification permission request failed:', error);
        }
      } else if (Notification.permission === 'denied') {
        console.info('Browser notifications are blocked; using in-app alerts only.');
      }
    };

    if (getStoredNotificationReady()) {
      enableNotifications();
      return undefined;
    }

    const handleFirstInteraction = () => {
      enableNotifications();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(bannerTimeoutRef.current);
    window.clearTimeout(highlightTimeoutRef.current);
    window.clearTimeout(screenFlashTimeoutRef.current);
    window.clearTimeout(soundResetTimeoutRef.current);
    window.clearTimeout(syncRefreshTimeoutRef.current);
  }, []);

  useEffect(() => {
    const readLeaderLease = () => {
      try {
        return JSON.parse(window.localStorage.getItem(DASHBOARD_LEADER_KEY) || 'null');
      } catch (error) {
        return null;
      }
    };

    const writeLeaderLease = () => {
      const lease = {
        tabId: tabIdRef.current,
        expiresAt: Date.now() + DASHBOARD_LEASE_MS,
      };
      window.localStorage.setItem(DASHBOARD_LEADER_KEY, JSON.stringify(lease));
    };

    const syncLeaderState = (isLeader) => {
      pollingLeaderRef.current = isLeader;
      setIsPollingLeader(isLeader);
    };

    const tryAcquireLeadership = () => {
      const currentLease = readLeaderLease();
      const now = Date.now();
      const leaseExpired = !currentLease || currentLease.expiresAt <= now;
      const isCurrentLeader = currentLease?.tabId === tabIdRef.current;

      if (leaseExpired || isCurrentLeader) {
        writeLeaderLease();
        syncLeaderState(true);
        return true;
      }

      syncLeaderState(false);
      return false;
    };

    const maintainLeadership = () => {
      if (pollingLeaderRef.current) {
        writeLeaderLease();
        return;
      }

      if (document.visibilityState === 'visible') {
        tryAcquireLeadership();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tryAcquireLeadership();
      }
    };

    const handleStorage = (event) => {
      if (event.key === DASHBOARD_LEADER_KEY) {
        tryAcquireLeadership();
      }

      if (!syncChannelRef.current && event.key === DASHBOARD_SYNC_FALLBACK_KEY && event.newValue) {
        try {
          const message = JSON.parse(event.newValue);
          handleSyncMessage(message);
        } catch (error) {
          console.error('Failed to parse dashboard sync message:', error);
        }
      }
    };

    const handleBeforeUnload = () => {
      const currentLease = readLeaderLease();
      if (currentLease?.tabId === tabIdRef.current) {
        window.localStorage.removeItem(DASHBOARD_LEADER_KEY);
      }
    };

    const postSyncMessage = (message) => {
      if (syncChannelRef.current) {
        syncChannelRef.current.postMessage(message);
        return;
      }

      window.localStorage.setItem(DASHBOARD_SYNC_FALLBACK_KEY, JSON.stringify(message));
      window.localStorage.removeItem(DASHBOARD_SYNC_FALLBACK_KEY);
    };

    const requestSyncRefresh = () => {
      postSyncMessage({
        type: 'refresh-request',
        sourceTabId: tabIdRef.current,
        timestamp: Date.now(),
      });
    };

    const scheduleFollowerRefresh = () => {
      window.clearTimeout(syncRefreshTimeoutRef.current);
      syncRefreshTimeoutRef.current = window.setTimeout(() => {
        fetchAllData(false, {
          suppressNotifications: true,
          broadcastChanges: false,
        });
      }, 150);
    };

    const handleSyncMessage = (message) => {
      if (!message || message.sourceTabId === tabIdRef.current) {
        return;
      }

      if (message.type === 'refresh-request') {
        if (pollingLeaderRef.current) {
          fetchAllData(false, {
            suppressNotifications: true,
            broadcastChanges: true,
          });
        }
        return;
      }

      if (message.type === 'orders-changed' && !pollingLeaderRef.current) {
        scheduleFollowerRefresh();
      }
    };

    if (typeof BroadcastChannel !== 'undefined') {
      syncChannelRef.current = new BroadcastChannel(DASHBOARD_SYNC_CHANNEL);
      syncChannelRef.current.onmessage = (event) => {
        handleSyncMessage(event.data);
      };
    }

    heartbeatIntervalRef.current = window.setInterval(maintainLeadership, DASHBOARD_LEADER_HEARTBEAT_MS);
    leaderCheckIntervalRef.current = window.setInterval(() => {
      if (!pollingLeaderRef.current) {
        tryAcquireLeadership();
      }
    }, DASHBOARD_LEADER_HEARTBEAT_MS);

    tryAcquireLeadership();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    dashboardSyncHelpersRef.current = {
      postSyncMessage,
      requestSyncRefresh,
      handleSyncMessage,
    };

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(heartbeatIntervalRef.current);
      window.clearInterval(leaderCheckIntervalRef.current);
      window.clearTimeout(syncRefreshTimeoutRef.current);
      syncChannelRef.current?.close();

      const currentLease = readLeaderLease();
      if (currentLease?.tabId === tabIdRef.current) {
        window.localStorage.removeItem(DASHBOARD_LEADER_KEY);
      }
    };
  }, []);

  const dashboardSyncHelpersRef = useRef({
    postSyncMessage: () => {},
    requestSyncRefresh: () => {},
  });

  const fetchAllData = async (isInitial = false, options = {}) => {
    const { suppressNotifications = false, broadcastChanges = false } = options;

    if (isInitial) {
      setLoading(true);
      setIsInitialLoad(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('todayOnly', '1');
      if (ENABLE_PAYMENT) {
        params.append('excludeCounterUnpaid', '1');
        params.append('excludeOnlinePending', '1');
      }
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('paymentMethod', paymentFilter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      const [res, completedRes, counterRes, allTodayRes] = await Promise.all([
        axios.get(`/api/orders?${params.toString()}`),
        axios.get(`/api/orders?status=${ENABLE_PAYMENT ? 'delivered' : 'collect_payment'}&sortBy=time&sortOrder=desc`),
        ENABLE_PAYMENT
          ? axios.get('/api/orders?paymentMethod=counter&paymentStatus=pending&sortBy=time&sortOrder=desc')
          : Promise.resolve({ data: { data: [] } }),
        axios.get('/api/orders?todayOnly=1&sortBy=time&sortOrder=desc'),
      ]);

      const allTodayOrders = allTodayRes.data.data || [];
      const allOrdersSignature = allTodayOrders
        .map(
          (order) =>
            `${order._id}:${order.orderStatus}:${order.paymentStatus}:${order.updatedAt || order.createdAt}`
        )
        .join('|');
      const currentOrderIds = new Set(allTodayOrders.map((order) => order._id));
      const latestOrder = allTodayOrders[0] || null;

      if (!suppressNotifications && previousOrderIdsRef.current.size > 0) {
        const newOrders = allTodayOrders.filter((order) => !previousOrderIdsRef.current.has(order._id));
        const unseenNewOrders = latestSeenOrderIdRef.current
          ? newOrders.filter((order) => order._id !== latestSeenOrderIdRef.current)
          : newOrders;
        if (unseenNewOrders.length > 0) {
          latestSeenOrderIdRef.current = unseenNewOrders[0]._id;
          notifyNewOrders(unseenNewOrders);
        }
      } else if (latestOrder) {
        latestSeenOrderIdRef.current = latestOrder._id;
      }

      if (latestOrder && !latestSeenOrderIdRef.current) {
        latestSeenOrderIdRef.current = latestOrder._id;
      }

      const hasMeaningfulChange = allOrdersSignatureRef.current !== allOrdersSignature;
      allOrdersSignatureRef.current = allOrdersSignature;
      previousOrderIdsRef.current = currentOrderIds;

      setPayAtCounterOrders(counterRes.data.data || []);
      setOrders(
        (res.data.data || []).filter((o) =>
          ENABLE_PAYMENT ? o.orderStatus !== 'delivered' : o.orderStatus !== 'collect_payment'
        )
      );
      setCompletedOrders(completedRes.data.data || []);

      if (broadcastChanges && hasMeaningfulChange) {
        dashboardSyncHelpersRef.current.postSyncMessage({
          type: 'orders-changed',
          sourceTabId: tabIdRef.current,
          timestamp: Date.now(),
        });
      }

    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      if (isInitial) {
        setLoading(false);
        setIsInitialLoad(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  const markAsPaid = async (order) => {
    setMarkingPaidId(order._id);
    try {
      await axios.patch(`/api/orders/${order._id}/payment`, { paymentStatus: 'paid' });
      await fetchAllData(false, {
        suppressNotifications: true,
        broadcastChanges: pollingLeaderRef.current,
      });
      if (!pollingLeaderRef.current) {
        dashboardSyncHelpersRef.current.requestSyncRefresh();
      }
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      alert('Failed to mark as paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const notifyNewOrders = (newOrders) => {
    const count = newOrders.length;
    const latest = newOrders[0];
    const orderIds = newOrders.map((order) => order._id);
    const bannerMessage = count === 1
      ? `New Order Received 🍽️ Order #${latest.orderId}`
      : `${count} New Orders Received 🍽️`;

    setAlertBanner(bannerMessage);
    setRecentNewOrderIds(orderIds);
    setScreenFlashVisible(true);

    window.clearTimeout(bannerTimeoutRef.current);
    window.clearTimeout(highlightTimeoutRef.current);
    window.clearTimeout(screenFlashTimeoutRef.current);

    bannerTimeoutRef.current = window.setTimeout(() => {
      setAlertBanner(null);
    }, ALERT_BANNER_DURATION_MS);

    highlightTimeoutRef.current = window.setTimeout(() => {
      setRecentNewOrderIds([]);
    }, ORDER_HIGHLIGHT_DURATION_MS);

    screenFlashTimeoutRef.current = window.setTimeout(() => {
      setScreenFlashVisible(false);
    }, 900);

    playNotificationSound();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const body = count === 1
        ? `${latest.customer?.name || 'Customer'} placed order ${latest.orderId}`
        : `${count} new orders just arrived`;
      new Notification('New Order Received', { body });
    }
  };

  const playNotificationSound = () => {
    if (typeof window === 'undefined') return;

    try {
      if (!notificationReadyRef.current) {
        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }

        const context = audioContextRef.current;
        const selectedSound = getStoredNotificationSound();
        const startBell = () => {
          playNotificationPreset({
            audioContext: context,
            presetKey: selectedSound,
          });
        };

        if (context.state === 'suspended') {
          context.resume().then(startBell).catch(() => {});
        } else {
          startBell();
        }
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(`/api/orders/${orderId}/status`, { orderStatus: newStatus });
      await fetchAllData(false, {
        suppressNotifications: true,
        broadcastChanges: pollingLeaderRef.current,
      });
      if (!pollingLeaderRef.current) {
        dashboardSyncHelpersRef.current.requestSyncRefresh();
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    }
  };

  const openEditOrder = (order) => {
    setEditingOrder(order);
    setSelectedRemovedItems([]);
  };

  const toggleRemovedItemSelection = (itemId) => {
    setSelectedRemovedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const saveEditedOrder = async () => {
    if (!editingOrder || selectedRemovedItems.length === 0) return;

    setEditingOrderBusy(true);
    try {
      await axios.patch(`/api/orders/${editingOrder._id}/items`, {
        removedItemIds: selectedRemovedItems,
      });
      setEditingOrder(null);
      setSelectedRemovedItems([]);
      await fetchAllData(false, {
        suppressNotifications: true,
        broadcastChanges: pollingLeaderRef.current,
      });
      if (!pollingLeaderRef.current) {
        dashboardSyncHelpersRef.current.requestSyncRefresh();
      }
    } catch (error) {
      console.error('Failed to edit order:', error);
      alert(error.response?.data?.message || 'Failed to update order');
    } finally {
      setEditingOrderBusy(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      verifying_payment: '#6f42c1',
      preparing: '#17a2b8',
      ready: '#28a745',
      delivered: '#6c757d',
      collect_payment: '#6c757d',
    };
    return colors[status] || '#6c757d';
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = ENABLE_PAYMENT
      ? {
          pending: 'preparing',
          verifying_payment: 'preparing',
          preparing: 'ready',
          ready: 'delivered',
        }
      : {
          pending: 'preparing',
          preparing: 'ready',
          ready: 'delivered',
          delivered: 'collect_payment',
        };
    return statusFlow[currentStatus];
  };

  const toggleItemPrepared = async (orderId, itemId, prepared) => {
    try {
      await axios.patch(`/api/orders/${orderId}/items/${itemId}/prepared`, { prepared });
      await fetchAllData(false, {
        suppressNotifications: true,
        broadcastChanges: pollingLeaderRef.current,
      });
      if (!pollingLeaderRef.current) {
        dashboardSyncHelpersRef.current.requestSyncRefresh();
      }
    } catch (error) {
      console.error('Failed to update item prepared state:', error);
      alert('Failed to update item prepared state');
    }
  };

  const getItemPrepared = (item) => typeof item.prepared === 'boolean' ? item.prepared : false;

  const toggleGroupPrepared = async (group, prepared) => {
    try {
      await Promise.all(
        group.rows.map((row) =>
          axios.patch(`/api/orders/${row.orderId}/items/${row.itemId}/prepared`, { prepared })
        )
      );
      await fetchAllData(false, {
        suppressNotifications: true,
        broadcastChanges: pollingLeaderRef.current,
      });
      if (!pollingLeaderRef.current) {
        dashboardSyncHelpersRef.current.requestSyncRefresh();
      }
    } catch (error) {
      console.error('Failed to update group prepared state:', error);
      alert('Failed to update prepared state for this item group');
    }
  };

  const buildPrepItems = (sourceOrders = orders) => {
    const map = new Map();
    sourceOrders
      .filter((order) => order.orderStatus !== 'delivered')
      .forEach((order) => {
        order.items.forEach((item) => {
          if (!item.menuItem) return;
          const key = item.menuItem._id || String(item.menuItem);
          if (!map.has(key)) {
            map.set(key, { menuItemId: key, name: item.menuItem.name, totalQuantity: 0, rows: [] });
          }
          const entry = map.get(key);
          entry.totalQuantity += item.quantity;
          entry.rows.push({
            orderId: order._id,
            orderDisplayId: order.orderId,
            customerName: order.customer?.name,
            quantity: item.quantity,
            itemId: item._id,
            prepared: getItemPrepared(item),
          });
        });
      });
    return Array.from(map.values());
  };

  // Search filtering — partial match on orderId (suffix match)
  const filterBySearch = (list, term) => {
    if (!term.trim()) return list;
    const t = term.trim().toLowerCase();
    return list.filter((o) => {
      const id = (o.orderId || '').toLowerCase();
      // Match suffix: "1" matches "0001", "01" matches "0001"
      const numericPart = id.split('-').pop() || id;
      return numericPart.endsWith(t) || id.includes(t) ||
        o.customer?.name?.toLowerCase().includes(t) ||
        o.customer?.phone?.includes(t);
    });
  };

  const filteredOrders = useMemo(() => filterBySearch(orders, orderSearch), [orders, orderSearch]);
  const filteredCompleted = useMemo(() => filterBySearch(completedOrders, completedSearch), [completedOrders, completedSearch]);

  const kitchenOrders = orders.filter(
    (o) => o.orderStatus === 'pending' || o.orderStatus === 'verifying_payment' || o.orderStatus === 'preparing'
  );

  const getDisplayStatusLabel = (status) => {
    if (status === 'verifying_payment') return 'Verifying Payment';
    if (status === 'collect_payment') return 'Collect Payment';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getOrderLocationLabel = (order) => {
    if (order.serviceType === 'table' && order.tableNumber) {
      return `Table ${order.tableNumber}`;
    }
    return 'Counter Pickup';
  };

  const renderCustomerComment = (order) => {
    const comment = order.customerComment?.trim();
    if (!comment) {
      return null;
    }

    return (
      <div className="order-comment">
        <span className="order-comment-label">Comment</span>
        <p>{comment}</p>
      </div>
    );
  };

  const isRecentlyArrivedOrder = (orderId) => recentNewOrderIds.includes(orderId);

  if (loading && isInitialLoad) {
    return (
      <OwnerLayout title="Dashboard">
        <div className="loading">Loading orders...</div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout title={<>Dashboard {isRefreshing && <span className="refresh-indicator">⟳</span>}</>}>
      {screenFlashVisible && <div className="new-order-screen-flash" aria-hidden="true" />}
      {alertBanner && (
        <div className="new-order-banner" role="status" aria-live="polite">
          <span className="new-order-banner-dot" aria-hidden="true" />
          <span>{alertBanner}</span>
        </div>
      )}
      <div className="db-toolbar">
        <button onClick={() => fetchAllData(false)} className="refresh-btn" title="Refresh">
          ⟳ Refresh
        </button>
      </div>
      <div>
        <div className="view-toggle">
          <button className={viewMode === 'normal' ? 'active' : ''} onClick={() => setViewMode('normal')}>
            Normal View
          </button>
          <button className={viewMode === 'kitchen' ? 'active' : ''} onClick={() => setViewMode('kitchen')}>
            Kitchen Mode
          </button>
        </div>

        {viewMode === 'normal' && (
          <div className="main-tabs">
            <button onClick={() => setActiveTab('active')} className={activeTab === 'active' ? 'active' : ''}>
              Active Orders
            </button>
            <button onClick={() => setActiveTab('prep')} className={activeTab === 'prep' ? 'active' : ''}>
              Items to Prepare
            </button>
            <button onClick={() => setActiveTab('completed')} className={activeTab === 'completed' ? 'active' : ''}>
              Completed Orders {completedOrders.length > 0 && <span className="tab-count">{completedOrders.length}</span>}
            </button>
          </div>
        )}

        {/* ── PAY AT COUNTER SECTION ── */}
        {ENABLE_PAYMENT && viewMode === 'normal' && activeTab === 'active' && payAtCounterOrders.length > 0 && (
          <section className="pay-at-counter-section">
            <h2 className="section-title">
              <span className="section-icon">💰</span> Pay at Counter — Collect Payment First
            </h2>
            <p className="section-hint">Mark as paid when you receive payment; the order will move to the main list.</p>
            <div className="orders-list pay-at-counter-list">
              {payAtCounterOrders.map((order) => (
                <div
                  key={order._id}
                  className={`order-card counter-card ${isRecentlyArrivedOrder(order._id) ? 'new-order-card' : ''}`}
                >
                  <div className="order-header">
                    <div>
                      <h3>Order #{order.orderId}</h3>
                      <p className="customer-info">{order.customer.name} — {order.customer.phone}</p>
                      <p className="table-info">{getOrderLocationLabel(order)}</p>
                      <p className="order-time">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                    </span>
                  </div>
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="order-item">
                        <span>{item.menuItem.name} x {item.quantity}</span>
                        <span>₹{item.priceAtTime * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {renderCustomerComment(order)}
                  <div className="order-footer">
                    <div className="order-total">
                      <span>Total to collect:</span>
                      <span>₹{order.totalAmount}</span>
                    </div>
                    <div className="order-actions">
                      <button onClick={() => markAsPaid(order)} disabled={markingPaidId === order._id} className="mark-paid-btn">
                        {markingPaidId === order._id ? '…' : '✓ Mark as Paid'}
                      </button>
                    </div>
                  </div>
                  {order.orderStatus !== 'delivered' && order.orderStatus !== 'collect_payment' && (
                    <div className="order-actions order-actions-secondary">
                      <button onClick={() => openEditOrder(order)} className="edit-order-btn">Edit Order</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── ACTIVE ORDERS HEADER + SEARCH ── */}
        {viewMode === 'normal' && activeTab === 'active' && (
          <>
            <div className="main-list-header">
              <h2 className="section-title main-list-title">Main Orders</h2>
              <button type="button" className="filters-toggle-btn" onClick={() => setShowFilters((prev) => !prev)}>
                {showFilters ? 'Hide Filters & Sort' : 'Show Filters & Sort'}
              </button>
            </div>
            <input
              className="order-search-input"
              type="text"
              placeholder="Search by order ID, name or phone…"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
          </>
        )}

        {/* ── FILTERS ── */}
        {viewMode === 'normal' && activeTab === 'active' && showFilters && (
          <div className="filters-section">
            <div className="filter-group">
              <label className="filter-label">Status:</label>
              <div className="filter-tabs">
                {(ENABLE_PAYMENT
                  ? ['all', 'pending', 'preparing', 'ready', 'verifying_payment']
                  : ['all', 'pending', 'preparing', 'ready', 'delivered']
                ).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'active' : ''}>
                    {s === 'all' ? 'All' : getDisplayStatusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
            {ENABLE_PAYMENT && (
              <div className="filter-group">
                <label className="filter-label">Payment:</label>
                <div className="filter-tabs">
                  {[['all', 'All'], ['counter', 'Pay at Counter'], ['online', 'Online Paid']].map(([val, label]) => (
                    <button key={val} onClick={() => setPaymentFilter(val)} className={paymentFilter === val ? 'active' : ''}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="filter-group">
              <label className="filter-label">Sort By:</label>
              <div className="sort-controls">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                  <option value="time">Time</option>
                  <option value="price">Price</option>
                  <option value="volume">Order Volume</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="sort-order-btn" title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVE ORDERS LIST ── */}
        {viewMode === 'normal' && activeTab === 'active' && (
          <div className="orders-list">
            {filteredOrders.length === 0 ? (
              <div className="empty-state">
                {orderSearch ? 'No orders match your search.' : 'No active orders. Pay-at-counter orders appear above after marking paid.'}
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order._id}
                  className={`order-card ${isRecentlyArrivedOrder(order._id) ? 'new-order-card' : ''}`}
                >
                  <div className="order-header">
                    <div>
                      <h3>Order #{order.orderId}</h3>
                      <p className="customer-info">{order.customer.name} - {order.customer.phone}</p>
                      <p className="table-info">{getOrderLocationLabel(order)}</p>
                      <p className="order-time">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                {getDisplayStatusLabel(order.orderStatus)}
              </span>
                  </div>
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="order-item">
                        <label className="order-item-label">
                          <input type="checkbox" checked={getItemPrepared(item)} onChange={(e) => toggleItemPrepared(order._id, item._id, e.target.checked)} />
                          <span>{item.menuItem.name} x {item.quantity}</span>
                        </label>
                        <span>₹{item.priceAtTime * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {renderCustomerComment(order)}
                  <div className="order-footer">
                    <div className="order-total">
                      <span>Total:</span>
                      <span>₹{order.totalAmount}</span>
                    </div>
                    <div className="payment-info">
                      <span>Payment:</span>
                      <span className={ENABLE_PAYMENT && order.paymentMethod === 'counter' && order.paymentStatus === 'pending' ? 'payment-warning' : ''}>
                        {order.paymentMethod === 'online' ? 'Online' : 'Counter'} — {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                      {!ENABLE_PAYMENT && order.orderStatus === 'delivered' && (
                        <span className="counter-badge">💰 Collect Payment</span>
                      )}
                      {ENABLE_PAYMENT && order.paymentMethod === 'counter' && order.paymentStatus === 'pending' && (
                        <span className="counter-badge">💰 Collect Payment</span>
                      )}
                    </div>
                  </div>
                  {order.orderStatus !== 'delivered' && order.orderStatus !== 'collect_payment' && (
                    <div className="order-actions order-actions-secondary">
                      <button onClick={() => openEditOrder(order)} className="edit-order-btn">Edit Order</button>
                    </div>
                  )}
                  {ENABLE_PAYMENT && order.orderStatus === 'verifying_payment' && (
                    <div className="order-actions">
                      <button onClick={() => updateOrderStatus(order._id, 'preparing')} className="status-btn">Verify Payment</button>
                    </div>
                  )}
                  {getNextStatus(order.orderStatus) && (!ENABLE_PAYMENT || order.orderStatus !== 'verifying_payment') && (
                    <div className="order-actions">
                      <button onClick={() => updateOrderStatus(order._id, getNextStatus(order.orderStatus))} className="status-btn">
                        Mark as {getDisplayStatusLabel(getNextStatus(order.orderStatus))}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ITEMS TO PREPARE ── */}
        {viewMode === 'normal' && activeTab === 'prep' && (
          <section className="prep-section">
            <h2 className="section-title">Items to Prepare</h2>
            <p className="section-hint">Combined view of all active orders grouped by item.</p>
            <div className="orders-list">
              {orders.length === 0 ? (
                <div className="empty-state">No active orders to prepare.</div>
              ) : (
                buildPrepItems().map((group) => (
                  <div key={group.menuItemId} className="order-card prep-card">
                    <div className="order-header">
                      <div>
                        <h3>
                          <label className="order-item-label">
                            <input type="checkbox" checked={group.rows.every((row) => row.prepared)} onChange={(e) => toggleGroupPrepared(group, e.target.checked)} />
                            <span>{group.name}</span>
                          </label>
                        </h3>
                        <p className="order-time">Total to prepare: {group.totalQuantity}</p>
                      </div>
                    </div>
                    <div className="order-items">
                      {group.rows.map((row) => (
                        <div key={row.itemId} className="order-item">
                          <label className="order-item-label">
                            <input type="checkbox" checked={row.prepared} onChange={(e) => toggleItemPrepared(row.orderId, row.itemId, e.target.checked)} />
                            <span>{row.quantity} for {row.customerName || 'Customer'} (Order {row.orderDisplayId})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ── COMPLETED ORDERS ── */}
        {viewMode === 'normal' && activeTab === 'completed' && (
          <section className="completed-section">
            <h2 className="section-title">Completed Orders</h2>
            <input
              className="order-search-input"
              type="text"
              placeholder="Search by order ID, name or phone…"
              value={completedSearch}
              onChange={(e) => setCompletedSearch(e.target.value)}
            />
            {filteredCompleted.length === 0 ? (
              <div className="empty-state">{completedSearch ? 'No orders match your search.' : 'No completed orders yet.'}</div>
            ) : (
              <div className="orders-list">
                {filteredCompleted.map((order) => (
                  <div
                    key={order._id}
                    className={`order-card completed-card ${isRecentlyArrivedOrder(order._id) ? 'new-order-card' : ''}`}
                  >
                    <div className="order-header">
                      <div>
                        <h3>Order #{order.orderId}</h3>
                        <p className="customer-info">{order.customer.name} — {order.customer.phone}</p>
                        <p className="table-info">{getOrderLocationLabel(order)}</p>
                        <p className="order-time">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                        {getDisplayStatusLabel(order.orderStatus)}
                      </span>
                    </div>
                    <div className="order-items">
                      {order.items.map((item, index) => (
                        <div key={index} className="order-item">
                          <span>{item.menuItem?.name} x {item.quantity}</span>
                          <span>₹{item.priceAtTime * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    {renderCustomerComment(order)}
                    <div className="order-footer">
                      <div className="order-total">
                        <span>Total:</span>
                        <span>₹{order.totalAmount}</span>
                      </div>
                      <div className="payment-info">
                        <span>{order.paymentMethod === 'online' ? 'Online' : 'Counter'} — {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── KITCHEN MODE ── */}
        {viewMode === 'kitchen' && (
          <section className="kitchen-section">
            <h2 className="section-title">Kitchen Mode</h2>
            <p className="section-hint">Pending and preparing orders only.</p>
            <div className="kitchen-orders">
              {kitchenOrders.length === 0 ? (
                <div className="empty-state">No pending or preparing orders.</div>
              ) : (
                kitchenOrders.map((order) => (
                  <div
                    key={order._id}
                    className={`kitchen-card ${isRecentlyArrivedOrder(order._id) ? 'new-order-card' : ''}`}
                  >
                    <div className="kitchen-header">
                      <div>
                        <h3>Order #{order.orderId}</h3>
                        {order.tableNumber && <p className="kitchen-table">Table: {order.tableNumber}</p>}
                      </div>
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                        {getDisplayStatusLabel(order.orderStatus)}
                      </span>
                    </div>
                    <div className="kitchen-items">
                      {order.items.map((item, index) => (
                        <div key={index} className="kitchen-item">
                          <label className="order-item-label">
                            <input type="checkbox" checked={getItemPrepared(item)} onChange={(e) => toggleItemPrepared(order._id, item._id, e.target.checked)} />
                            <span className="kitchen-item-name">{item.menuItem.name}</span>
                          </label>
                          <span className="kitchen-item-qty">x {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    {renderCustomerComment(order)}
                    <div className="kitchen-actions">
                      {ENABLE_PAYMENT && order.orderStatus === 'verifying_payment' && (
                        <button className="kitchen-btn start" onClick={() => updateOrderStatus(order._id, 'preparing')}>Verify Payment</button>
                      )}
                      {order.orderStatus === 'pending' && (
                        <button className="kitchen-btn start" onClick={() => updateOrderStatus(order._id, 'preparing')}>Start Preparing</button>
                      )}
                      {order.orderStatus === 'preparing' && (
                        <button className="kitchen-btn ready" onClick={() => updateOrderStatus(order._id, 'ready')}>Mark as Ready</button>
                      )}
                      {order.orderStatus === 'ready' && (
                        <button className="kitchen-btn ready" onClick={() => updateOrderStatus(order._id, 'delivered')}>Mark as Delivered</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {kitchenOrders.length > 0 && (
              <section className="prep-section">
                <h2 className="section-title">Items to Prepare (Kitchen View)</h2>
                <div className="orders-list">
                  {buildPrepItems(kitchenOrders).map((group) => (
                    <div key={group.menuItemId} className="order-card prep-card">
                      <div className="order-header">
                        <div>
                          <h3>
                            <label className="order-item-label">
                              <input type="checkbox" checked={group.rows.every((r) => r.prepared)} onChange={(e) => toggleGroupPrepared(group, e.target.checked)} />
                              <span>{group.name}</span>
                            </label>
                          </h3>
                          <p className="order-time">Total to prepare: {group.totalQuantity}</p>
                        </div>
                      </div>
                      <div className="order-items">
                        {group.rows.map((row) => (
                          <div key={row.itemId} className="order-item">
                            <label className="order-item-label">
                              <input type="checkbox" checked={row.prepared} onChange={(e) => toggleItemPrepared(row.orderId, row.itemId, e.target.checked)} />
                              <span>{row.quantity} for {row.customerName || 'Customer'} (Order {row.orderDisplayId})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}
      </div>
      {editingOrder && (
        <div className="edit-order-modal-backdrop" onClick={() => setEditingOrder(null)}>
          <div className="edit-order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-order-modal-header">
              <h2>Edit Order {editingOrder.orderId}</h2>
              <button type="button" className="edit-order-close" onClick={() => setEditingOrder(null)}>✕</button>
            </div>
            <p className="section-hint">Select items to remove. Unavailable items are highlighted.</p>
            <div className="edit-order-items">
              {editingOrder.items.map((item) => (
                <label
                  key={item._id}
                  className={`edit-order-item ${item.menuItem?.available === false || !item.menuItem ? 'is-unavailable' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRemovedItems.includes(item._id)}
                    onChange={() => toggleRemovedItemSelection(item._id)}
                  />
                  <span>
                    {item.menuItem?.name || 'Removed Item'} x {item.quantity} - ₹{item.priceAtTime * item.quantity}
                    {(item.menuItem?.available === false || !item.menuItem) && ' (Unavailable)'}
                  </span>
                </label>
              ))}
            </div>
            <div className="edit-order-modal-actions">
              <button type="button" className="edit-order-btn secondary" onClick={() => setEditingOrder(null)}>Cancel</button>
              <button
                type="button"
                className="edit-order-btn"
                disabled={editingOrderBusy || selectedRemovedItems.length === 0}
                onClick={saveEditedOrder}
              >
                {editingOrderBusy ? 'Saving…' : 'Remove Selected Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </OwnerLayout>
  );
};

export default Dashboard;
