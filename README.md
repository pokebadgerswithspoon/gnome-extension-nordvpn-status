# NordVPN protection widged

This is a very simple extension that shows if you are connecting to the
internet via a NordVPN server (in which case it shows which one) or not.  its
main use case is if you don't have a kill-switch on your system, or if you switch
between multiple VPN servers and need a reminder of which one you are currently
using.

The extension fetches the complete lists of NordVPN servers at startup, after
which it checks your public IP against the cached lookup table every minute.

At least at the moment, the extension does _not_ check for DNS leakage, as this
should be a one-off static setting, independent from you being connected to the
VPN or not.  You can however check for leakage via some online service like for
example: https://www.dnsleaktest.com/
